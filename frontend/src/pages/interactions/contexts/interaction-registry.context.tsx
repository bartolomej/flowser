import React, {
  createContext,
  ReactElement,
  useContext,
  useState,
} from "react";
import { FclValueLookupByIdentifier } from "./definition.context";

type InteractionsRegistry = {
  definitions: InteractionDefinition[];
  focusedDefinition: InteractionDefinition;
  getById: (id: string) => InteractionDefinition;
  update: (interaction: InteractionDefinition) => void;
  create: (interaction: InteractionDefinition) => void;
  setFocused: (interactionId: string) => void;
};

export type InteractionDefinition = {
  id: string;
  name: string;
  sourceCode: string;
  initialFclValuesByIdentifier: FclValueLookupByIdentifier;
  initialOutcome: FlowInteractionOutcome;
  transactionOptions: TransactionOptions;
};

export type TransactionOptions = {
  authorizerAddresses: string[];
  proposerAddress: string;
  payerAddress: string;
};

export type FlowTransactionOutcome = {
  transactionId?: string;
  error?: string;
};

export type FlowScriptOutcome = {
  result?: unknown;
  error?: string;
};

export type FlowInteractionOutcome = {
  transaction?: FlowTransactionOutcome;
  script?: FlowScriptOutcome;
};

const Context = createContext<InteractionsRegistry>(undefined as never);

export function InteractionRegistryProvider(props: {
  children: React.ReactNode;
}): ReactElement {
  const initialInteractionDefinition: InteractionDefinition = {
    name: "Demo",
    id: "demo",
    sourceCode: "transaction {}",
    initialFclValuesByIdentifier: new Map(),
    initialOutcome: {},
    transactionOptions: {
      authorizerAddresses: [],
      proposerAddress: "0xf8d6e0586b0a20c7",
      payerAddress: "0xf8d6e0586b0a20c7",
    },
  };
  const [definitions, setDefinitions] = useState<InteractionDefinition[]>([
    initialInteractionDefinition,
  ]);
  const [focusedInteractionId, setFocusedInteractionId] = useState<string>(
    definitions[0].id
  );

  function update(updatedInteraction: InteractionDefinition) {
    setDefinitions((interactions) =>
      interactions.map((existingInteraction) => {
        if (existingInteraction.id === updatedInteraction.id) {
          return updatedInteraction;
        }
        return existingInteraction;
      })
    );
  }

  function create(newInteraction: InteractionDefinition) {
    const isExisting = definitions.some(
      (definition) => definition.id === newInteraction.id
    );
    if (!isExisting) {
      setDefinitions([...definitions, newInteraction]);
    }
  }

  function getById(id: string) {
    const definition = definitions.find((definition) => definition.id === id);
    if (!definition) {
      throw new Error(`Definition not found by id: ${id}`);
    }
    return definition;
  }

  return (
    <Context.Provider
      value={{
        definitions,
        focusedDefinition: getById(focusedInteractionId),
        setFocused: setFocusedInteractionId,
        create,
        update,
        getById,
      }}
    >
      {props.children}
    </Context.Provider>
  );
}

export function useInteractionRegistry(): InteractionsRegistry {
  const context = useContext(Context);

  if (context === undefined) {
    throw new Error("Interaction definitions manager provider not found");
  }

  return context;
}
