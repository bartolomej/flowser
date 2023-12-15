"use client";
import { InteractionsPage } from "@onflowser/ui/src/interactions/InteractionsPage";
import { InteractionRegistryProvider } from "@onflowser/ui/src/interactions/contexts/interaction-registry.context";
import { TemplatesRegistryProvider } from "@onflowser/ui/src/interactions/contexts/templates.context";
import { NavigationProvider } from "@onflowser/ui/src/contexts/navigation.context";
import { ReactNode } from "react";
import { useParams, useSelectedLayoutSegments, usePathname, useSearchParams, useRouter } from "next/navigation";
import {
  ExecuteScriptRequest, IFlowService,
  IInteractionService, SendTransactionRequest,
  ServiceRegistryProvider
} from "@onflowser/ui/src/contexts/service-registry.context";
import {
  FlowAccount, FlowAccountKey, FlowAccountStorage, FlowBlock, FlowContract, FlowEvent, FlowTransaction,
  InteractionTemplate, IResourceIndexReader,
  ParsedInteractionOrError
} from "@onflowser/api";
import {
  BlockchainIndexes,
  FlowAccountStorageService, FlowGatewayService,
  FlowIndexerService,
  IFlowserLogger,
  InMemoryIndex
} from "@onflowser/core";
import { ChainID, ChainIdProvider, isValidChainID } from "@onflowser/ui/src/contexts/chain-id.context";
import { ScriptOutcome } from "@onflowser/ui/src/interactions/core/core-types";


class InteractionsService implements IInteractionService {

  constructor(private readonly flowGatewayService: FlowGatewayService) {}

  async executeScript(request: ExecuteScriptRequest): Promise<ScriptOutcome> {
    const result = await this.flowGatewayService.executeScript({
      cadence: request.cadence,
      arguments: request.arguments
    });

    return {
      result
    }
  }

  getTemplates(): Promise<InteractionTemplate[]> {
    return Promise.resolve([]);
  }

  async parse(sourceCode: string): Promise<ParsedInteractionOrError> {
    // It doesn't matter which chain ID we use in URL.
    const url = new URL(`${window.location.origin}/flow-emulator/interactions/parsed`);
    url.searchParams.append("sourceCode", sourceCode);
    return fetch(url).then(res => res.json())
  }

  sendTransaction(request: SendTransactionRequest): Promise<{ transactionId: string }> {
    return Promise.resolve({ transactionId: "" });
  }

}

class WebLogger implements IFlowserLogger {
  debug(message: any): void {
    console.debug(message);
  }

  error(message: any, error?: unknown): void {
    console.error(message, error);
  }

  log(message: any): void {
    console.log(message);
  }

  verbose(message: any): void {
    console.debug(message);
  }

  warn(message: any): void {
    console.warn(message);
  }

}

class FlowserAppService {
  readonly blockchainIndexes: BlockchainIndexes;
  readonly logger: IFlowserLogger;
  readonly flowAccountStorageService: FlowAccountStorageService;
  readonly flowGatewayService: FlowGatewayService;
  readonly interactionsService: InteractionsService;
  private readonly indexer: FlowIndexerService;

  constructor() {
    this.blockchainIndexes = {
      accountKey: new InMemoryIndex(),
      transaction: new InMemoryIndex(),
      block: new InMemoryIndex(),
      account: new InMemoryIndex(),
      event: new InMemoryIndex(),
      contract: new InMemoryIndex(),
      accountStorage: new InMemoryIndex(),
    }

    this.logger = new WebLogger();
    this.flowGatewayService = new FlowGatewayService()
    this.interactionsService = new InteractionsService(
      this.flowGatewayService
    )
    this.flowAccountStorageService = new FlowAccountStorageService(this.flowGatewayService);

    this.indexer = new FlowIndexerService(
      this.logger,
      this.flowAccountStorageService,
      this.flowGatewayService,
      this.interactionsService,
      this.blockchainIndexes
    )
  }

  getTransactionIndex(): IResourceIndexReader<FlowTransaction> {
    return {
      findAll: () => this.blockchainIndexes.transaction.findAll(),
      findOneById: async id => {
        const existing = await this.blockchainIndexes.transaction.findOneById(id);
        if (existing) {
          return existing;
        }
        const [transaction, transactionStatus] = await Promise.all([
          this.flowGatewayService.getTransactionById(id),
          this.flowGatewayService.getTransactionStatusById(id),
        ]);
        await this.indexer.processTransaction({
          transaction,
          transactionStatus
        });
        return this.blockchainIndexes.transaction.findOneById(id);
      },
    }
  }

  getBlockIndex(): IResourceIndexReader<FlowBlock> {
    return {
      findAll: () => this.blockchainIndexes.block.findAll(),
      findOneById: async id => {
        console.log("block id", id);
        return undefined;
      }
    }
  }

  getAccountsIndex(): IResourceIndexReader<FlowAccount> {
    return {
      findAll: () => this.blockchainIndexes.account.findAll(),
      findOneById: async id => {
        console.log("account id", id);
        return undefined;
      }
    }
  }

  getEventsIndex(): IResourceIndexReader<FlowEvent> {
    return {
      findAll: () => this.blockchainIndexes.event.findAll(),
      findOneById: async id => {
        console.log("event id", id);
        return undefined;
      }
    }
  }

  getContractsIndex(): IResourceIndexReader<FlowContract> {
    return {
      findAll: () => this.blockchainIndexes.contract.findAll(),
      findOneById: async id => {
        console.log("contract id", id);
        return undefined;
      }
    }
  }

  getAccountStorageIndex(): IResourceIndexReader<FlowAccountStorage> {
    return {
      findAll: () => this.blockchainIndexes.accountStorage.findAll(),
      findOneById: async id => {
        console.log("storage id", id);
        return undefined;
      }
    }
  }

  getAccountKeysIndex(): IResourceIndexReader<FlowAccountKey> {
    return {
      findAll: () => this.blockchainIndexes.accountKey.findAll(),
      findOneById: async id => {
        console.log("account key id", id);
        return undefined;
      }
    }
  }
}

const appService = new FlowserAppService();

export default function Page() {
  const { chainId } = useParams();

  if (!isValidChainID(chainId)) {
    return <div>Unknown chain</div>
  }

  function configureGateway(chainId: ChainID) {
    switch (chainId) {
      case "flow-emulator":
        return appService.flowGatewayService.configure({
          network: "local",
          restServerAddress: "http://localhost:8080"
        });
      case "flow-testnet":
        return appService.flowGatewayService.configure({
          network: "testnet",
          restServerAddress: "https://rest-testnet.onflow.org"
        });
      case "flow-mainnet":
        return appService.flowGatewayService.configure({
          network: "mainnet",
          restServerAddress: "https://rest-mainnet.onflow.org"
        });
      default:
        throw new Error(`Unsupported chain: ${chainId}`)
    }
  }

  configureGateway(chainId);

  return (
    <ChainIdProvider config={{ chainId }}>
      <NextJsNavigationProvider>
        <ServiceRegistryProvider
          // @ts-ignore
          services={{
            flowService: new FlowService(),
            interactionsService: appService.interactionsService,
            transactionsIndex: appService.getTransactionIndex(),
            blocksIndex: appService.getBlockIndex(),
            accountIndex: appService.getAccountsIndex(),
            eventsIndex: appService.getEventsIndex(),
            contractIndex: appService.getContractsIndex(),
            accountStorageIndex: appService.getAccountStorageIndex(),
            accountKeyIndex: appService.getAccountKeysIndex()
          }}
        >
          <InteractionRegistryProvider>
            <TemplatesRegistryProvider>
              <InteractionsPage />
            </TemplatesRegistryProvider>
          </InteractionRegistryProvider>
        </ServiceRegistryProvider>
      </NextJsNavigationProvider>
    </ChainIdProvider>
  );
}

class FlowService implements IFlowService {
    async getIndexOfAddress(chainID: ChainID, address: string): Promise<number> {
      const response = await fetch(`${window.location.origin}/${chainID}/addresses/${address}/index`);
      const data = await response.json();
      return data.index as number;
    }
}

function NextJsNavigationProvider(props: { children: ReactNode }) {
  const params = useParams();
  const matches = useSelectedLayoutSegments();
  const pathname = usePathname();
  const {} = useRouter();
  const search = useSearchParams();

  function navigate() {
    // TODO(web-mvp): Implement
  }


  console.log({ matches, pathname });
  return (
    <NavigationProvider controller={{
      params,
      // TODO(web-mvp): Implement matches
      matches: [],
      navigate,
      location: {
        search,
        pathname,
        // TODO(web-mvp): Implement hash
        hash: ""
      }
    }}>
      {props.children}
    </NavigationProvider>
  );
}