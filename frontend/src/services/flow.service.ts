import {
  GetFlowInteractionTemplatesResponse,
  GetFlowConfigResponse,
} from "@flowser/shared";
import { TransportService } from "./transports/transport.service";

export class FlowService {
  constructor(private readonly transport: TransportService) {}

  getInteractionTemplates(): Promise<GetFlowInteractionTemplatesResponse> {
    return this.transport.send({
      requestMethod: "GET",
      resourceIdentifier: `/api/flow/templates`,
      responseProtobuf: GetFlowInteractionTemplatesResponse,
    });
  }

  getConfig(): Promise<GetFlowConfigResponse> {
    return this.transport.send({
      requestMethod: "GET",
      resourceIdentifier: `/api/flow/config`,
      responseProtobuf: GetFlowConfigResponse,
    });
  }
}