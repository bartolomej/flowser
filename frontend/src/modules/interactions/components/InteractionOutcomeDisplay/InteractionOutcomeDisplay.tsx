import React, { ReactElement, useEffect, useState } from "react";
import { useInteractionOutcomeManager } from "../../contexts/outcome.context";
import { ScriptError } from "../../../../components/status/ErrorMessage";
import { JsonView } from "../../../../components/json-view/JsonView";
import { useGetTransaction } from "../../../../hooks/use-api";
import classes from "./InteractionOutcomeDisplay.module.scss";
import { TabItem } from "../../../../components/tabs/Tabs";
import { Callout } from "../../../../components/callout/Callout";
import { useInteractionDefinitionManager } from "../../contexts/definition.context";
import { InteractionKind } from "@flowser/shared";
import { ExternalLink } from "../../../../components/links/ExternalLink";
import { LineSeparator } from "../../../../components/line-separator/LineSeparator";
import { SpinnerWithLabel } from "../../../../components/spinner/SpinnerWithLabel";
import { StyledTabs } from "../../../../components/tabs/StyledTabs";
import { TransactionDetailsTabs } from "../../../transactions/TransactionDetailsTabs/TransactionDetailsTabs";
import { ScriptOutcome, TransactionOutcome } from "../../core/core-types";

export function InteractionOutcomeDisplay(): ReactElement {
  const { outcome } = useInteractionOutcomeManager();
  return (
    <div className={classes.root}>
      {outcome?.script && <ScriptOutcomeDisplay outcome={outcome.script} />}
      {outcome?.transaction && (
        <TransactionOutcomeDisplay outcome={outcome.transaction} />
      )}
      {!outcome && (
        <div className={classes.emptyStateWrapper}>
          <EmptyState />
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  const { parsedInteraction } = useInteractionDefinitionManager();

  switch (parsedInteraction?.kind) {
    case InteractionKind.INTERACTION_SCRIPT:
      return (
        <Callout
          icon="💡"
          title="Cadence scripts"
          description={
            <div>
              <p>
                Here are a few resources you can look into, to learn more about
                Cadence scripts on Flow.
              </p>
              <LineSeparator horizontal />
              <ExternalLink href="https://academy.ecdao.org/en/cadence-by-example/6-scripts" />
              <ExternalLink href="https://academy.ecdao.org/en/catalog/courses/beginner-cadence/chapter2/lesson2#scripts" />
            </div>
          }
        />
      );
    case InteractionKind.INTERACTION_TRANSACTION:
      return (
        <Callout
          icon="💡"
          title="Cadence transactions"
          description={
            <div>
              <p>
                Here are a few resources you can look into, to learn more about
                Cadence transactions on Flow.
              </p>
              <LineSeparator horizontal />
              <ExternalLink href="https://developers.flow.com/cadence/language/transactions" />
              <ExternalLink href="https://academy.ecdao.org/en/cadence-by-example/5-transaction" />
              <ExternalLink href="https://academy.ecdao.org/en/catalog/courses/beginner-cadence/chapter2/lesson2#transactions" />
            </div>
          }
        />
      );
    default:
      return (
        <Callout
          icon="🚀"
          title="Getting started #onFlow"
          description={
            <div>
              <p>
                Here are some resources that should help you get started on
                Flow.
              </p>
              <LineSeparator horizontal />
              <ExternalLink href="https://developers.flow.com" />
              <ExternalLink href="https://academy.ecdao.org" />
            </div>
          }
        />
      );
  }
}

function TransactionOutcomeDisplay(props: { outcome: TransactionOutcome }) {
  const { outcome } = props;
  const { data } = useGetTransaction(outcome.transactionId);

  if (!data?.transaction) {
    return <SpinnerWithLabel label="Executing" />;
  }

  return (
    <TransactionDetailsTabs
      // Re-mount this component when different transaction is used.
      // This is mainly to reset the initial focused tab.
      key={data.transaction.id}
      label="Transaction"
      includeOverviewTab={true}
      includeScriptTab={false}
      transaction={data.transaction}
    />
  );
}

function ScriptOutcomeDisplay(props: { outcome: ScriptOutcome }) {
  const { result, error } = props.outcome;
  const resultTabId = "result";
  const errorTabId = "result";
  const [currentTabId, setCurrentTabId] = useState(resultTabId);

  useEffect(() => {
    if (error && currentTabId !== errorTabId) {
      setCurrentTabId(errorTabId);
    }
  }, [error, currentTabId]);

  const tabs: TabItem[] = [];

  if (error) {
    tabs.push({
      id: errorTabId,
      label: "Error",
      content: <ScriptError errorMessage={error} />,
    });
  } else {
    tabs.push({
      id: resultTabId,
      label: "Result",
      content: <JsonView name="result" data={{ value: result }} />,
    });
  }

  return (
    <StyledTabs
      label="Script"
      currentTabId={currentTabId}
      onChangeTab={(tab) => setCurrentTabId(tab.id)}
      tabs={tabs}
    />
  );
}
