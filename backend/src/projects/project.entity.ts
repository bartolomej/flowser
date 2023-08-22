import { Column, Entity, PrimaryColumn } from "typeorm";
import { BadRequestException } from "@nestjs/common";
import { typeOrmProtobufTransformer } from "../utils/common-utils";
import { CreateProjectDto } from "./dto/create-project.dto";
import { PollingEntity } from "../core/entities/polling.entity";
import { Emulator, Gateway, Project } from "@flowser/shared";
import { UpdateProjectDto } from "./dto/update-project.dto";
import * as crypto from "crypto";
import { PollingEntityInitArguments } from "../utils/type-utils";

type ProjectEntityInitArgs = PollingEntityInitArguments<ProjectEntity>;

@Entity({ name: "projects" })
export class ProjectEntity extends PollingEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column()
  filesystemPath: string;

  // TODO(milestone-3): gateway should be synced with network settings in flow.json
  @Column("simple-json", {
    nullable: true,
    transformer: typeOrmProtobufTransformer(Gateway),
  })
  gateway: Gateway;

  // TODO(milestone-3): emulator should be synced with settings in flow.json
  @Column("simple-json", {
    nullable: true,
    transformer: typeOrmProtobufTransformer(Emulator),
  })
  emulator: Emulator | null;

  // User can specify (on a project level) the starting block height.
  // Blockchain data will be fetched from this height Value if set.
  @Column({ nullable: true })
  startBlockHeight: number = 0;

  // Entities are also automatically initialized by TypeORM.
  // In those cases no constructor arguments are provided.
  constructor(args: ProjectEntityInitArgs | undefined) {
    super();
    this.id = args?.id ?? "";
    this.name = args?.name ?? "";
    this.filesystemPath = args?.filesystemPath ?? "";
    this.gateway = args?.gateway ?? Gateway.fromPartial({});
    this.emulator = args?.emulator ?? Emulator.fromPartial({});
    this.startBlockHeight = args?.startBlockHeight ?? 0;
  }

  hasGatewayConfiguration() {
    return this.gateway !== null;
  }

  toProto(): Project {
    return {
      id: this.id,
      name: this.name,
      filesystemPath: this.filesystemPath,
      startBlockHeight: this.startBlockHeight ?? -1,
      gateway: this.gateway,
      emulator: this.emulator ?? undefined,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static create(projectDto: CreateProjectDto | UpdateProjectDto) {
    const isUpdateDto = "id" in projectDto && Boolean(projectDto.id);

    if (!projectDto.filesystemPath) {
      throw new BadRequestException("Missing project filesystem path");
    }
    if (!projectDto.name) {
      throw new BadRequestException("Missing project name");
    }
    if (
      projectDto.startBlockHeight === null ||
      projectDto.startBlockHeight === undefined
    ) {
      throw new BadRequestException("Missing project start block height");
    }

    return new ProjectEntity({
      id: isUpdateDto ? projectDto.id : crypto.randomUUID(),
      name: projectDto.name,
      startBlockHeight: projectDto.startBlockHeight,
      filesystemPath: projectDto.filesystemPath,
      gateway: projectDto.emulator
        ? Gateway.fromPartial({
            restServerAddress: `http://localhost:${projectDto.emulator.restServerPort}`,
            grpcServerAddress: `http://localhost:${projectDto.emulator.grpcServerPort}`,
          })
        : Gateway.fromJSON(projectDto.gateway),
      emulator: Emulator.fromJSON(projectDto.emulator),
    });
  }
}
