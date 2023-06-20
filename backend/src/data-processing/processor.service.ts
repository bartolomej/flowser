import { Injectable, Logger } from "@nestjs/common";
import {
  FlowAccount,
  FlowBlock,
  FlowCollection,
  FlowEvent,
  FlowGatewayService,
  FlowKey,
  FlowSignableObject,
  FlowTransaction,
  FlowTransactionStatus,
} from "../flow/services/gateway.service";
import { BlocksService } from "../blocks/blocks.service";
import { TransactionsService } from "../transactions/transactions.service";
import { AccountsService } from "../accounts/services/accounts.service";
import { ContractsService } from "../accounts/services/contracts.service";
import { EventsService } from "../events/events.service";
import { AccountEntity } from "../accounts/entities/account.entity";
import { EventEntity } from "../events/event.entity";
import { TransactionEntity } from "../transactions/transaction.entity";
import { BlockEntity } from "../blocks/entities/block.entity";
import { AccountContractEntity } from "../accounts/entities/contract.entity";
import { KeysService } from "../accounts/services/keys.service";
import { AccountKeyEntity } from "../accounts/entities/key.entity";
import { ensureNonPrefixedAddress, ensurePrefixedAddress } from "../utils";
import { getDataSourceInstance } from "../database";
import { ProjectContextLifecycle } from "../flow/utils/project-context";
import { ProjectEntity } from "../projects/project.entity";
import { FlowAccountStorageService } from "../flow/services/storage.service";
import { AccountStorageService } from "../accounts/services/storage.service";
import {
  FlowCoreEventType,
  ManagedProcessState,
  ServiceStatus,
  SignableObject,
  TransactionStatus,
} from "@flowser/shared";
import {
  ProcessManagerEvent,
  ProcessManagerService,
} from "../processes/process-manager.service";
import {
  ManagedProcessEntity,
  ManagedProcessEvent,
} from "../processes/managed-process.entity";
import { CacheRemovalService } from "../core/services/cache-removal.service";
import {
  FlowEmulatorService,
  WellKnownAddressesOptions,
} from "../flow/services/emulator.service";
import { AsyncIntervalScheduler } from "../core/async-interval-scheduler";

type BlockData = {
  block: FlowBlock;
  transactions: FlowTransactionWithStatus[];
  collections: FlowCollection[];
  events: ExtendedFlowEvent[];
};

type UnprocessedBlockInfo = {
  nextBlockHeightToProcess: number;
  latestUnprocessedBlockHeight: number;
};

type FlowTransactionWithStatus = FlowTransaction & {
  status: FlowTransactionStatus;
};

export type ExtendedFlowEvent = FlowEvent & {
  blockId: string;
  transactionId: string;
};

@Injectable()
export class ProcessorService implements ProjectContextLifecycle {
  private projectContext: ProjectEntity | undefined;
  private emulatorProcess: ManagedProcessEntity | undefined;
  private readonly logger = new Logger(ProcessorService.name);
  private readonly processingIntervalMs = 500;
  private processingScheduler: AsyncIntervalScheduler;

  constructor(
    private blockService: BlocksService,
    private transactionService: TransactionsService,
    private accountService: AccountsService,
    private accountStorageService: AccountStorageService,
    private accountKeysService: KeysService,
    private contractService: ContractsService,
    private eventService: EventsService,
    private flowStorageService: FlowAccountStorageService,
    private flowGatewayService: FlowGatewayService,
    private processManagerService: ProcessManagerService,
    private commonService: CacheRemovalService,
    private flowEmulatorService: FlowEmulatorService
  ) {
    this.processingScheduler = new AsyncIntervalScheduler({
      name: "Blockchain processing",
      intervalInMs: this.processingIntervalMs,
      functionToExecute: this.processBlockchainData.bind(this),
    });
  }

  onEnterProjectContext(project: ProjectEntity): void {
    this.processingScheduler?.start();
    this.projectContext = project;
    this.emulatorProcess = this.processManagerService.get(
      FlowEmulatorService.processId
    );
    this.processManagerService.on(
      ProcessManagerEvent.PROCESS_ADDED,
      this.onProcessAddedOrUpdated.bind(this)
    );
    this.processManagerService.on(
      ProcessManagerEvent.PROCESS_UPDATED,
      this.onProcessAddedOrUpdated.bind(this)
    );
  }

  onExitProjectContext(): void {
    this.processingScheduler?.stop();
    this.projectContext = undefined;
    this.processManagerService.removeListener(
      ProcessManagerEvent.PROCESS_ADDED,
      this.onProcessAddedOrUpdated.bind(this)
    );
    this.processManagerService.removeListener(
      ProcessManagerEvent.PROCESS_UPDATED,
      this.onProcessAddedOrUpdated.bind(this)
    );
    this.emulatorProcess?.removeListener(
      ManagedProcessEvent.STATE_CHANGE,
      this.onProcessStateChange.bind(this)
    );
  }

  private onProcessAddedOrUpdated(process: ManagedProcessEntity) {
    const isEmulatorProcess = process.id === FlowEmulatorService.processId;
    if (isEmulatorProcess) {
      this.logger.debug(`Emulator was started or updated`);
      // Remove any previous listeners
      this.emulatorProcess?.removeListener(
        ManagedProcessEvent.STATE_CHANGE,
        this.onProcessStateChange.bind(this)
      );
      // Update internal process instance & reattach listener
      this.emulatorProcess = process;
      this.emulatorProcess.on(
        ManagedProcessEvent.STATE_CHANGE,
        this.onProcessStateChange.bind(this)
      );
    }
  }

  private async onProcessStateChange(state: ManagedProcessState) {
    if (state === ManagedProcessState.MANAGED_PROCESS_STATE_RUNNING) {
      this.logger.debug("Emulator process was started, reindexing");
      // Reindex all blockchain data when the emulator is started (restarted)
      await this.commonService.removeAll();
    }
  }

  async getTotalBlocksToProcess() {
    const { nextBlockHeightToProcess, latestUnprocessedBlockHeight } =
      await this.getUnprocessedBlocksInfo();

    return latestUnprocessedBlockHeight - (nextBlockHeightToProcess - 1);
  }

  async processBlockchainData(): Promise<void> {
    if (!this.projectContext) {
      return;
    }
    const gatewayStatus = await FlowGatewayService.getApiStatus(
      this.projectContext.gateway
    );
    if (gatewayStatus !== ServiceStatus.SERVICE_STATUS_ONLINE) {
      return;
    }

    // When using non-managed emulator,
    // we don't know if the blockchain uses monotonic or non-monotonic addresses,
    // so we need to try processing well-known accounts with both options.
    const isManagedEmulator = this.emulatorProcess?.isRunning();
    if (!isManagedEmulator) {
      await this.processWellKnownAccounts({
        overrideUseMonotonicAddresses: true,
      });
      await this.processWellKnownAccounts({
        overrideUseMonotonicAddresses: false,
      });
    } else {
      // Process with whatever address schema is currently used.
      await this.processWellKnownAccounts();
    }

    const { nextBlockHeightToProcess, latestUnprocessedBlockHeight } =
      await this.getUnprocessedBlocksInfo();
    const hasBlocksToProcess =
      nextBlockHeightToProcess <= latestUnprocessedBlockHeight;

    if (!hasBlocksToProcess) {
      return;
    }

    try {
      for (
        let height = nextBlockHeightToProcess;
        height <= latestUnprocessedBlockHeight;
        height++
      ) {
        this.logger.debug(`Processing block: ${height}`);
        // Blocks must be processed in sequential order (not in parallel)
        // because objects on subsequent blocks can reference objects from previous blocks
        // (e.g. a transaction may reference an account from previous block)
        await this.processBlockWithHeight(height);
      }
    } catch (e) {
      return this.logger.debug(`failed to fetch block data: ${e}`);
    }
  }

  private async getUnprocessedBlocksInfo(): Promise<UnprocessedBlockInfo> {
    const [lastStoredBlock, latestBlock] = await Promise.all([
      this.blockService.findLastBlock(),
      this.flowGatewayService.getLatestBlock(),
    ]);
    const nextBlockHeightToProcess = lastStoredBlock
      ? lastStoredBlock.blockHeight + 1
      : this.projectContext.startBlockHeight;
    const latestUnprocessedBlockHeight = latestBlock.height;

    return {
      nextBlockHeightToProcess,
      latestUnprocessedBlockHeight,
    };
  }

  private async processBlockWithHeight(height: number) {
    const dataSource = await getDataSourceInstance();
    const queryRunner = dataSource.createQueryRunner();

    const blockData = await this.getBlockData(height);

    // Process events first, so that transactions can reference created users.
    await this.processNewEvents({
      flowEvents: blockData.events,
      flowBlock: blockData.block,
    });

    try {
      await queryRunner.startTransaction();

      await this.storeBlockData(blockData);
      await this.reProcessStorageForAllAccounts();

      await queryRunner.commitTransaction();
    } catch (e) {
      await queryRunner.rollbackTransaction();

      this.logger.error(`Failed to store latest data`, e);
    } finally {
      await queryRunner.release();
    }

    try {
      blockData.transactions.map((transaction) =>
        this.subscribeToTransactionStatusUpdates(transaction.id)
      );
    } catch (e) {
      this.logger.error("Transaction status update failed", e);
    }
  }

  private async subscribeToTransactionStatusUpdates(
    transactionId: string
  ): Promise<void> {
    const unsubscribe = await this.flowGatewayService
      .getTxStatusSubscription(transactionId)
      .subscribe((newStatus) =>
        this.transactionService.updateStatus(
          transactionId,
          TransactionStatus.fromJSON({
            errorMessage: newStatus.errorMessage,
            grcpStatus: newStatus.statusCode,
            executionStatus: newStatus.status,
          })
        )
      );
    try {
      await this.flowGatewayService
        .getTxStatusSubscription(transactionId)
        .onceSealed();
    } catch (e) {
      this.logger.debug(`Failed to wait on sealed transaction:`, e);
    } finally {
      // Once transaction is sealed, status won't change anymore.
      unsubscribe();
    }
  }

  private async storeBlockData(data: BlockData) {
    const blockPromise = this.blockService
      .create(this.createBlockEntity({ flowBlock: data.block }))
      .catch((e) =>
        this.logger.error(`block save error: ${e.message}`, e.stack)
      );
    const transactionPromises = Promise.all(
      data.transactions.map((transaction) =>
        this.processNewTransaction({
          flowBlock: data.block,
          flowTransaction: transaction,
          flowTransactionStatus: transaction.status,
        }).catch((e) =>
          this.logger.error(`transaction save error: ${e.message}`, e.stack)
        )
      )
    );
    const eventPromises = Promise.all(
      data.events.map((flowEvent) =>
        this.eventService
          .create(
            this.createEventEntity({
              flowEvent,
              flowBlock: data.block,
            })
          )
          .catch((e) =>
            this.logger.error(`event save error: ${e.message}`, e.stack)
          )
      )
    );

    return Promise.all([blockPromise, transactionPromises, eventPromises]);
  }

  private async getBlockData(height: number): Promise<BlockData> {
    const block = await this.flowGatewayService.getBlockByHeight(height);
    const collections = await Promise.all(
      block.collectionGuarantees.map(async (guarantee) =>
        this.flowGatewayService.getCollectionById(guarantee.collectionId)
      )
    );
    const transactionIds = collections
      .map((collection) => collection.transactionIds)
      .flat();

    const transactionFutures = Promise.all(
      transactionIds.map((txId) =>
        this.flowGatewayService.getTransactionById(txId)
      )
    );
    const transactionStatusesFutures = Promise.all(
      transactionIds.map((txId) =>
        this.flowGatewayService.getTransactionStatusById(txId)
      )
    );

    const [transactions, statuses] = await Promise.all([
      transactionFutures,
      transactionStatusesFutures,
    ]);

    const transactionsWithStatuses = transactions.map((transaction, index) => ({
      ...transaction,
      status: statuses[index],
    }));

    const events = transactionsWithStatuses
      .map((tx) =>
        tx.status.events.map((event) => ({
          ...event,
          transactionId: tx.id,
          blockId: tx.referenceBlockId,
        }))
      )
      .flat();

    return {
      block,
      collections,
      transactions: transactionsWithStatuses,
      events,
    };
  }

  private async processNewEvents(options: {
    flowEvents: FlowEvent[];
    flowBlock: FlowBlock;
  }) {
    const { flowEvents, flowBlock } = options;
    // Process new accounts first, so other events can reference them.
    const accountCreatedEvents = flowEvents.filter(
      (event) => event.type === FlowCoreEventType.ACCOUNT_CREATED
    );
    const restEvents = flowEvents.filter(
      (event) => event.type !== FlowCoreEventType.ACCOUNT_CREATED
    );
    await Promise.all(
      accountCreatedEvents.map((flowEvent) =>
        this.processStandardEvents({ flowEvent, flowBlock }).catch((e) => {
          this.logger.error(
            `flow.AccountCreated event handling error: ${
              e.message
            } (${JSON.stringify(flowEvent)})`,
            e.stack
          );
        })
      )
    );
    await Promise.all(
      restEvents.map((flowEvent) =>
        this.processStandardEvents({ flowEvent, flowBlock }).catch((e) => {
          this.logger.error(
            `${flowEvent.type} event handling error: ${
              e.message
            } (${JSON.stringify(flowEvent)})`,
            e.stack
          );
        })
      )
    );
  }

  private async processStandardEvents(options: {
    flowEvent: FlowEvent;
    flowBlock: FlowBlock;
  }) {
    const { flowEvent, flowBlock } = options;
    this.logger.debug(
      `handling event: ${flowEvent.type} ${JSON.stringify(flowEvent.data)}`
    );

    const monotonicAddresses = this.flowEmulatorService.getWellKnownAddresses({
      overrideUseMonotonicAddresses: true,
    });
    const nonMonotonicAddresses =
      this.flowEmulatorService.getWellKnownAddresses({
        overrideUseMonotonicAddresses: false,
      });

    const buildFlowTokensWithdrawnEvent = (address: string) =>
      `A.${ensureNonPrefixedAddress(address)}.FlowToken.TokensWithdrawn`;
    const buildFlowTokensDepositedEvent = (address: string) =>
      `A.${ensureNonPrefixedAddress(address)}.FlowToken.TokensDeposited`;

    const address = ensurePrefixedAddress(flowEvent.data.address);
    switch (flowEvent.type) {
      case FlowCoreEventType.ACCOUNT_CREATED:
        return this.storeNewAccountWithContractsAndKeys({ address, flowBlock });
      case FlowCoreEventType.ACCOUNT_KEY_ADDED:
      case FlowCoreEventType.ACCOUNT_KEY_REMOVED:
        return this.updateStoredAccountKeys({ address, flowBlock });
      case FlowCoreEventType.ACCOUNT_CONTRACT_ADDED:
      case FlowCoreEventType.ACCOUNT_CONTRACT_UPDATED:
      case FlowCoreEventType.ACCOUNT_CONTRACT_REMOVED:
        // TODO: Use event.data.address & event.data.contract to determine updated/created/removed contract
        return this.updateStoredAccountContracts({ address, flowBlock });
      // For now keep listening for monotonic and non-monotonic addresses,
      // although I think only non-monotonic ones are used for contract deployment.
      // See: https://github.com/onflow/flow-emulator/issues/421#issuecomment-1596844610
      case buildFlowTokensWithdrawnEvent(monotonicAddresses.flowTokenAddress):
      case buildFlowTokensWithdrawnEvent(
        nonMonotonicAddresses.flowTokenAddress
      ):
        return this.reprocessAccountFlowBalance(flowEvent.data.from);
      case buildFlowTokensDepositedEvent(monotonicAddresses.flowTokenAddress):
      case buildFlowTokensDepositedEvent(
        nonMonotonicAddresses.flowTokenAddress
      ):
        return this.reprocessAccountFlowBalance(flowEvent.data.to);
      default:
        return null; // not a standard event, ignore it
    }
  }

  private async reprocessAccountFlowBalance(address: string) {
    const flowAccount = await this.flowGatewayService.getAccount(address);
    await this.accountService.upsert({
      address: flowAccount.address,
      balance: flowAccount.balance,
    });
  }

  private async processNewTransaction(options: {
    flowBlock: FlowBlock;
    flowTransaction: FlowTransaction;
    flowTransactionStatus: FlowTransactionStatus;
  }) {
    this.transactionService.createOrUpdate(
      this.createTransactionEntity(options)
    );
  }

  private async storeNewAccountWithContractsAndKeys(options: {
    address: string;
    flowBlock: FlowBlock | undefined;
  }) {
    const { address, flowBlock } = options;
    const flowAccount = await this.flowGatewayService.getAccount(address);
    const unSerializedAccount = this.createAccountEntity({
      flowAccount,
      flowBlock,
    });
    const allPossibleWellKnownAddresses = [
      this.getAllWellKnownAddresses({ overrideUseMonotonicAddresses: true }),
      this.getAllWellKnownAddresses({ overrideUseMonotonicAddresses: false }),
    ].flat();
    if (allPossibleWellKnownAddresses.includes(unSerializedAccount.address)) {
      unSerializedAccount.isDefaultAccount = true;
    }
    const newContracts = Object.keys(flowAccount.contracts).map((name) =>
      this.createContractEntity({
        flowAccount,
        flowBlock,
        name,
        code: flowAccount.contracts[name],
      })
    );

    await this.accountService.upsert(unSerializedAccount);
    await Promise.all([
      this.accountKeysService.updateAccountKeys(
        address,
        unSerializedAccount.keys
      ),
      this.contractService.updateAccountContracts(
        unSerializedAccount.address,
        newContracts
      ),
    ]);
  }

  private async updateStoredAccountKeys(options: {
    address: string;
    flowBlock: FlowBlock;
  }) {
    const { address, flowBlock } = options;
    const flowAccount = await this.flowGatewayService.getAccount(address);
    await Promise.all([
      this.accountService.markUpdated(address),
      this.accountKeysService.updateAccountKeys(
        address,
        flowAccount.keys.map((flowKey) =>
          this.createKeyEntity({ flowAccount, flowKey, flowBlock })
        )
      ),
    ]);
  }

  private async updateStoredAccountContracts(options: {
    address: string;
    flowBlock: FlowBlock;
  }) {
    const { address, flowBlock } = options;
    const flowAccount = await this.flowGatewayService.getAccount(address);
    const newContracts = Object.keys(flowAccount.contracts).map((name) =>
      this.createContractEntity({
        flowAccount,
        flowBlock,
        name,
        code: flowAccount.contracts[name],
      })
    );

    await Promise.all([
      this.accountService.markUpdated(address),
      this.contractService.updateAccountContracts(address, newContracts),
    ]);
  }

  private async reProcessStorageForAllAccounts() {
    const allAddresses = await this.accountService.findAllAddresses();
    this.logger.debug(
      `Processing storages for accounts: ${allAddresses.join(", ")}`
    );
    await Promise.all(
      allAddresses.map((address) => this.processAccountStorage(address))
    );
  }

  private async processAccountStorage(address: string) {
    const { privateItems, publicItems, storageItems } =
      await this.flowStorageService.getAccountStorage(address);
    return this.accountStorageService.updateAccountStorage(address, [
      ...privateItems,
      ...publicItems,
      ...storageItems,
    ]);
  }

  private async isServiceAccountProcessed(options?: WellKnownAddressesOptions) {
    const { serviceAccountAddress } =
      this.flowEmulatorService.getWellKnownAddresses(options);
    try {
      const serviceAccount = await this.accountService.findOneByAddress(
        serviceAccountAddress
      );

      // Service account is already created by the wallet service,
      // but that service doesn't set the public key.
      // So if public key isn't present,
      // we know that we haven't processed this account yet.
      return Boolean(serviceAccount.keys[0]?.publicKey);
    } catch (e) {
      // Service account not found
      return false;
    }
  }

  private async processWellKnownAccounts(options?: WellKnownAddressesOptions) {
    const isAlreadyProcessed = await this.isServiceAccountProcessed(options);

    if (isAlreadyProcessed) {
      // Assume all other accounts are also processed (we batch process them together).
      return;
    }

    const dataSource = await getDataSourceInstance();
    const queryRunner = dataSource.createQueryRunner();

    // Afaik these well-known default accounts are
    // bootstrapped in a "meta-transaction",
    // which is hidden from the public blockchain.
    // See: https://github.com/onflow/flow-go/blob/master/fvm/bootstrap.go
    const nonExistingBlock: FlowBlock = {
      id: "NULL",
      blockSeals: [],
      collectionGuarantees: [],
      height: 0,
      parentId: "",
      signatures: [],
      timestamp: 0,
    };

    await queryRunner.startTransaction();
    try {
      await Promise.all(
        this.getAllWellKnownAddresses(options).map((address) =>
          this.storeNewAccountWithContractsAndKeys({
            address,
            flowBlock: nonExistingBlock,
          })
        )
      );
      await queryRunner.commitTransaction();
    } catch (error) {
      this.logger.error("Default account processing failed", error);
      await queryRunner.rollbackTransaction();
    } finally {
      await queryRunner.release();
    }
  }

  private getAllWellKnownAddresses(options?: WellKnownAddressesOptions) {
    // TODO(snapshots-revamp): Try processing monotonic and normal addresses
    //  as we don't know which setting is used if non-managed emulator is used.
    const wellKnownAddresses =
      this.flowEmulatorService.getWellKnownAddresses(options);
    return [
      wellKnownAddresses.serviceAccountAddress,
      wellKnownAddresses.fungibleTokenAddress,
      wellKnownAddresses.flowFeesAddress,
      wellKnownAddresses.flowTokenAddress,
    ];
  }

  private createAccountEntity(options: {
    flowAccount: FlowAccount;
    // Undefined in case we don't want to update block ID.
    flowBlock: FlowBlock;
  }): AccountEntity {
    const { flowAccount, flowBlock } = options;
    const account = AccountEntity.createDefault();
    account.blockId = flowBlock.id;
    account.address = ensurePrefixedAddress(flowAccount.address);
    account.balance = flowAccount.balance;
    account.code = flowAccount.code;
    account.keys = flowAccount.keys.map((flowKey) =>
      this.createKeyEntity({ flowAccount, flowKey, flowBlock })
    );
    return account;
  }

  private createKeyEntity(options: {
    flowAccount: FlowAccount;
    flowKey: FlowKey;
    flowBlock: FlowBlock;
  }) {
    const { flowAccount, flowKey, flowBlock } = options;
    const key = new AccountKeyEntity();
    key.blockId = flowBlock.id;
    key.index = flowKey.index;
    key.accountAddress = ensurePrefixedAddress(flowAccount.address);
    key.publicKey = flowKey.publicKey;
    key.signAlgo = flowKey.signAlgo;
    key.hashAlgo = flowKey.hashAlgo;
    key.weight = flowKey.weight;
    key.sequenceNumber = flowKey.sequenceNumber;
    key.revoked = flowKey.revoked;
    return key;
  }

  private createEventEntity(options: {
    flowEvent: ExtendedFlowEvent;
    flowBlock: FlowBlock;
  }): EventEntity {
    const { flowEvent, flowBlock } = options;
    const event = new EventEntity();
    event.blockId = flowBlock.id;
    event.type = flowEvent.type;
    event.transactionIndex = flowEvent.transactionIndex;
    event.transactionId = flowEvent.transactionId;
    event.blockId = flowEvent.blockId;
    event.eventIndex = flowEvent.eventIndex;
    event.data = flowEvent.data;
    return event;
  }

  private createBlockEntity(options: { flowBlock: FlowBlock }): BlockEntity {
    const { flowBlock } = options;
    const block = new BlockEntity();
    block.blockId = flowBlock.id;
    block.collectionGuarantees = flowBlock.collectionGuarantees;
    block.blockSeals = flowBlock.blockSeals;
    // TODO(milestone-x): "signatures" field is not present in block response
    // https://github.com/onflow/fcl-js/issues/1355
    block.signatures = flowBlock.signatures ?? [];
    block.timestamp = new Date(flowBlock.timestamp);
    block.blockHeight = flowBlock.height;
    block.parentId = flowBlock.parentId;
    return block;
  }

  private createContractEntity(options: {
    flowBlock: FlowBlock | undefined;
    flowAccount: FlowAccount;
    name: string;
    code: string;
  }) {
    const { flowAccount, flowBlock, name, code } = options;
    const contract = new AccountContractEntity();
    contract.blockId = flowBlock.id;
    contract.accountAddress = ensurePrefixedAddress(flowAccount.address);
    contract.name = name;
    contract.code = code;
    // contract.updateId();
    return contract;
  }

  private createTransactionEntity(options: {
    flowBlock: FlowBlock;
    flowTransaction: FlowTransaction;
    flowTransactionStatus: FlowTransactionStatus;
  }): TransactionEntity {
    const { flowBlock, flowTransaction, flowTransactionStatus } = options;
    const transaction = new TransactionEntity();
    transaction.id = flowTransaction.id;
    transaction.script = flowTransaction.script;
    transaction.payerAddress = ensurePrefixedAddress(flowTransaction.payer);
    transaction.blockId = flowBlock.id;
    transaction.referenceBlockId = flowTransaction.referenceBlockId;
    transaction.gasLimit = flowTransaction.gasLimit;
    transaction.authorizers = flowTransaction.authorizers.map((address) =>
      ensurePrefixedAddress(address)
    );
    transaction.args = flowTransaction.args;
    transaction.proposalKey = {
      ...flowTransaction.proposalKey,
      address: ensurePrefixedAddress(flowTransaction.proposalKey.address),
    };
    transaction.envelopeSignatures = this.deserializeSignableObjects(
      flowTransaction.envelopeSignatures
    );
    transaction.payloadSignatures = this.deserializeSignableObjects(
      flowTransaction.payloadSignatures
    );
    transaction.status = TransactionStatus.fromJSON({
      errorMessage: flowTransactionStatus.errorMessage,
      grcpStatus: flowTransactionStatus.statusCode,
      executionStatus: flowTransactionStatus.status,
    });
    return transaction;
  }

  private deserializeSignableObjects(signableObjects: FlowSignableObject[]) {
    return signableObjects.map((signable) =>
      SignableObject.fromJSON({
        ...signable,
        address: ensurePrefixedAddress(signable.address),
      })
    );
  }
}