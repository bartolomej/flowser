import { PollingEntity } from "../../core/entities/polling.entity";
import { Column, Entity, ManyToOne, PrimaryColumn } from "typeorm";
import { AccountEntity } from "./account.entity";
import { BadRequestException } from "@nestjs/common";
import { BlockContextEntity } from "../../blocks/entities/block-context.entity";
import { PollingEntityInitArguments } from "../../utils/type-utils";

type AccountContractEntityInitArgs = Omit<
  PollingEntityInitArguments<AccountContractEntity>,
  "id"
>;

@Entity({ name: "contracts" })
export class AccountContractEntity
  extends PollingEntity
  implements BlockContextEntity
{
  @PrimaryColumn()
  accountAddress: string;

  @PrimaryColumn()
  name: string;

  // Nullable for backward compatability - to not cause not null constraint failure on migration.
  @Column({ nullable: true })
  blockId: string;

  @Column("text")
  code: string;

  @ManyToOne(() => AccountEntity, (account) => account.contracts)
  account: AccountEntity | null;

  // Entities are also automatically initialized by TypeORM.
  // In those cases no constructor arguments are provided.
  constructor(args: AccountContractEntityInitArgs | undefined) {
    super();
    this.accountAddress = args?.accountAddress ?? "";
    this.name = args?.name ?? "";
    this.blockId = args?.blockId ?? "";
    this.code = args?.code ?? "";
    this.account = args?.account ?? null;
  }

  get id() {
    return `${this.accountAddress}.${this.name}`;
  }

  public static decodeId(id: string) {
    const idParts = id.split(".");
    if (idParts.length !== 2) {
      throw new BadRequestException("Invalid contract id");
    }
    const [accountAddress, name] = idParts;
    return { accountAddress, name };
  }
}
