import { Column, Entity, PrimaryColumn } from "typeorm";
import { PollingEntity } from "../../common/entities/polling.entity";
import { FlowBlock } from "../../flow/services/gateway.service";
import {
  Block,
  CollectionGuarantee,
} from "@flowser/types/generated/entities/blocks";
import { typeOrmProtobufTransformer } from "../../utils";

@Entity({ name: "blocks" })
export class BlockEntity extends PollingEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  parentId: string;

  @Column()
  height: number;

  @Column("datetime")
  timestamp: Date;

  @Column("simple-json", {
    transformer: typeOrmProtobufTransformer(CollectionGuarantee),
  })
  collectionGuarantees: CollectionGuarantee[];

  // TODO(milestone-x): Define type (Note: we aren't showing blockSeals anywhere)
  @Column("simple-json")
  blockSeals: any[];

  @Column("simple-array")
  signatures: string[];

  static create(flowBlock: FlowBlock): BlockEntity {
    const block = new BlockEntity();
    block.id = flowBlock.id;
    block.collectionGuarantees = flowBlock.collectionGuarantees;
    block.blockSeals = flowBlock.blockSeals;
    // TODO(milestone-3): why is "signatures" field not present in block response?
    // https://github.com/onflow/fcl-js/issues/1355
    block.signatures = flowBlock.signatures ?? [];
    block.timestamp = new Date(flowBlock.timestamp);
    block.height = flowBlock.height;
    block.parentId = flowBlock.parentId;
    return block;
  }

  toProto(): Block {
    return {
      id: this.id,
      parentId: this.parentId,
      height: this.height,
      timestamp: this.timestamp.toISOString(),
      blockSeals: this.blockSeals,
      signatures: this.signatures,
      collectionGuarantees: this.collectionGuarantees,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
