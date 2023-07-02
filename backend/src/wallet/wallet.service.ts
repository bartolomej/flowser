import {
  Injectable,
  PreconditionFailedException,
  Logger,
} from "@nestjs/common";
import { ec as EC } from "elliptic";
import { SHA3 } from "sha3";
import { FlowCliService, KeyWithWeight } from "../flow/services/cli.service";
import { AccountsService } from "../accounts/services/accounts.service";
import { AccountEntity } from "../accounts/entities/account.entity";
import { ensurePrefixedAddress } from "../utils/common-utils";
import {
  AccountKeyEntity,
  defaultKeyWeight,
} from "../accounts/entities/key.entity";
import { KeysService } from "../accounts/services/keys.service";
import {
  FlowAuthorizationFunction,
  FlowGatewayService,
} from "../flow/services/gateway.service";
import {
  SendTransactionRequest,
  SendTransactionResponse,
} from "@flowser/shared";
import { FlowConfigService } from "../flow/services/config.service";
import { ProjectContextLifecycle } from "../flow/utils/project-context";
import { ProjectEntity } from "src/projects/project.entity";
const fcl = require("@onflow/fcl");

const ec: EC = new EC("p256");

@Injectable()
export class WalletService implements ProjectContextLifecycle {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly cliService: FlowCliService,
    private readonly flowGateway: FlowGatewayService,
    private readonly flowConfig: FlowConfigService,
    private readonly accountsService: AccountsService,
    private readonly keysService: KeysService
  ) {}

  async onEnterProjectContext(project: ProjectEntity): Promise<void> {
    // TODO(snapshots-revamp): Re-import accounts when flow.json is updated
    //  (it could be the case that user is manually adding new managed accounts with `flow accounts create` command).
    await this.importAccountsFromConfig();
  }

  async onExitProjectContext(): Promise<void> {
    // Nothing to do here
  }

  public async sendTransaction(
    request: SendTransactionRequest
  ): Promise<SendTransactionResponse> {
    const [proposer, payer, authorizations] = await Promise.all([
      this.withAuthorization(request.proposerAddress),
      this.withAuthorization(request.payerAddress),
      Promise.all(
        request.authorizerAddresses.map((authorizerAddress) =>
          this.withAuthorization(authorizerAddress)
        )
      ),
    ]);

    return this.flowGateway.sendTransaction({
      cadence: request.cadence,
      proposer,
      payer,
      authorizations,
    });
  }

  private async withAuthorization(address: string) {
    const storedAccount =
      await this.accountsService.findOneWithRelationsByAddress(address);

    if (!storedAccount.keys) {
      throw new Error("Keys not loaded for account");
    }

    const credentialsWithPrivateKeys = storedAccount.keys.filter((key) =>
      Boolean(key.privateKey)
    );
    const isManagedAccount = credentialsWithPrivateKeys.length > 0;

    if (!isManagedAccount) {
      throw new PreconditionFailedException(
        `Authorizer account ${address} isn't managed by Flowser.`,
        "Flowser doesn't store private keys of the provided account."
      );
    }

    const credentialToUse = credentialsWithPrivateKeys[0];

    const authn: FlowAuthorizationFunction = (
      fclAccount: Record<string, unknown> = {}
    ) => ({
      ...fclAccount,
      tempId: `${address}-${credentialToUse.index}`,
      addr: fcl.sansPrefix(address),
      keyId: credentialToUse.index,
      signingFunction: (signable: any) => {
        if (!credentialToUse.privateKey) {
          throw new Error("Private key not found");
        }
        return {
          addr: fcl.withPrefix(address),
          keyId: credentialToUse.index,
          signature: this.signWithPrivateKey(
            credentialToUse.privateKey,
            signable.message
          ),
        };
      },
    });

    return authn;
  }

  private async importAccountsFromConfig() {
    const accountsConfig = this.flowConfig.getAccounts();
    await Promise.all(
      accountsConfig.map(async (accountConfig) => {
        const accountAddress = ensurePrefixedAddress(accountConfig.address);

        const keyEntity = AccountKeyEntity.createDefault();
        keyEntity.index = 0;
        keyEntity.accountAddress = accountAddress;
        // Public key is not stored in flow.json,
        // so just use empty value for now.
        // This should be updated by the aggregator service once it's picked up.
        keyEntity.publicKey = "";
        keyEntity.privateKey = accountConfig.privateKey;

        const accountEntity = AccountEntity.createDefault();
        accountEntity.address = accountAddress;
        accountEntity.keys = [keyEntity];

        try {
          const isOnNetwork = await this.isAccountCreatedOnNetwork(
            accountAddress
          );

          if (!isOnNetwork) {
            // Ideally we could create this account on the blockchain, but:
            // - we would need to retrieve the public key from the private key we store in flow.json
            // - seems like flow team doesn't recommend doing this: https://github.com/onflow/flow-emulator/issues/405
            this.logger.debug(
              `Account ${accountAddress} is not created on the network, skipping import.`
            );
            return;
          }

          await this.accountsService.upsert(accountEntity);
          await this.keysService.updateAccountKeys(
            accountEntity.address,
            accountEntity.keys
          );
        } catch (e) {
          // Ignore
          this.logger.debug("Managed account import failed", e);
        }
      })
    );
  }

  public async createAccount(): Promise<AccountEntity> {
    // For now, we only support a single key per account,
    // but we could as well add support for attaching
    // multiple keys with (possibly) different weights.
    const generatedKeyPairs = await Promise.all([
      this.cliService.generateKey(),
    ]);
    const generatedAccount = await this.cliService.createAccount({
      keys: generatedKeyPairs.map(
        (key): KeyWithWeight => ({
          weight: defaultKeyWeight,
          publicKey: key.public,
        })
      ),
    });
    const accountEntity = AccountEntity.createDefault();
    accountEntity.address = ensurePrefixedAddress(generatedAccount.address);
    accountEntity.keys = generatedKeyPairs.map((generatedKey) => {
      const key = AccountKeyEntity.createDefault();
      key.accountAddress = accountEntity.address;
      key.index = generatedAccount.keys.findIndex(
        (key) => key === generatedKey.public
      );
      key.publicKey = generatedKey.public;
      key.privateKey = generatedKey.private;
      return key;
    });

    await this.accountsService.upsert(accountEntity);
    await this.keysService.updateAccountKeys(
      accountEntity.address,
      accountEntity.keys
    );

    // Assume only a single key per account for now
    const singlePrivateKey = accountEntity.keys[0].privateKey;
    if (!singlePrivateKey) {
      throw new Error("Private key not found");
    }

    // For now, we just write new accounts to flow.json,
    // but they don't get recreated on the next emulator run.
    // See: https://github.com/onflow/flow-emulator/issues/405
    await this.flowConfig.updateAccounts([
      {
        // TODO(custom-wallet): Come up with a human-readable name generation
        name: accountEntity.address,
        address: accountEntity.address,
        privateKey: singlePrivateKey,
      },
    ]);

    return accountEntity;
  }

  // Returns whether the account exists on the current blockchain.
  private async isAccountCreatedOnNetwork(address: string): Promise<boolean> {
    try {
      // Check if account is found on the blockchain.
      // Will throw if not found.
      await this.flowGateway.getAccount(address);
      return true;
    } catch (error: unknown) {
      const isNotFoundError = String(error).includes(
        "could not find account with address"
      );
      if (isNotFoundError) {
        return false;
      }

      throw error;
    }
  }

  private signWithPrivateKey(privateKey: string, message: string) {
    const key = ec.keyFromPrivate(Buffer.from(privateKey, "hex"));
    const sig = key.sign(this.hashMessage(message));
    const n = 32;
    const r = sig.r.toArrayLike(Buffer, "be", n);
    const s = sig.s.toArrayLike(Buffer, "be", n);
    return Buffer.concat([r, s]).toString("hex");
  }

  private hashMessage(msg: string) {
    const sha = new SHA3(256);
    sha.update(Buffer.from(msg, "hex"));
    return sha.digest();
  }
}
