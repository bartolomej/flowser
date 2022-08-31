import { Injectable } from "@nestjs/common";
import { ContractsService } from "../accounts/services/contracts.service";
import { AccountsService } from "../accounts/services/accounts.service";
import { TransactionsService } from "../transactions/transactions.service";
import { BlocksService } from "../blocks/blocks.service";
import { EventsService } from "../events/events.service";
import { LogsService } from "../logs/logs.service";
import { KeysService } from "../accounts/services/keys.service";
import { AccountStorageService } from "../accounts/services/storage.service";

@Injectable()
export class CommonService {
  constructor(
    private contractsService: ContractsService,
    private accountsService: AccountsService,
    private blocksService: BlocksService,
    private transactionsService: TransactionsService,
    private eventsService: EventsService,
    private logsService: LogsService,
    private accountKeysService: KeysService,
    private accountStorageService: AccountStorageService
  ) {}

  async getCounters() {
    const [logs, accounts, blocks, transactions, events, contracts] =
      await Promise.all([
        this.logsService.countAll(),
        this.accountsService.countAll(),
        this.blocksService.countAll(),
        this.transactionsService.countAll(),
        this.eventsService.countAll(),
        this.contractsService.countAll(),
      ]);
    return {
      logs,
      accounts,
      blocks,
      transactions,
      events,
      contracts,
    };
  }

  async removeBlockchainData() {
    // Remove contracts before removing accounts, because of the foreign key constraint.
    await Promise.all([
      this.contractsService.removeAll(),
      this.accountKeysService.removeAll(),
      this.accountStorageService.removeAll(),
    ]);
    await Promise.all([
      this.accountsService.removeAll(),
      this.blocksService.removeAll(),
      this.eventsService.removeAll(),
      this.logsService.removeAll(),
      this.transactionsService.removeAll(),
    ]);
  }
}
