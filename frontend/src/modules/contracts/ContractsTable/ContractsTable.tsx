import { createColumnHelper } from "@tanstack/table-core";
import { DecoratedPollingEntity } from "../../../contexts/timeout-polling.context";
import { AccountContract } from "@flowser/shared";
import Label from "../../../components/misc/Label/Label";
import Value from "../../../components/misc/Value/Value";
import { AccountLink } from "../../accounts/AccountLink/AccountLink";
import React, { ReactElement, useMemo } from "react";
import { BaseTable } from "../../../components/misc/BaseTable/BaseTable";
import { ProjectLink } from "../../../components/links/ProjectLink";
import { Tooltip } from "../../../components/overlays/Tooltip/Tooltip";
import { BaseBadge } from "../../../components/misc/BaseBadge/BaseBadge";
import classes from "./ContractsTable.module.scss";
import { TimeAgo } from "../../../components/time/TimeAgo/TimeAgo";

const columnHelper =
  createColumnHelper<DecoratedPollingEntity<AccountContract>>();

const columns = [
  columnHelper.accessor("name", {
    header: () => <Label variant="medium">NAME</Label>,
    cell: (info) => (
      <Value>
        <ProjectLink to={`/contracts/${info.row.original.id}`}>
          {info.row.original.name}
        </ProjectLink>
      </Value>
    ),
  }),
  columnHelper.accessor("accountAddress", {
    header: () => <Label variant="medium">DEPLOYED ON</Label>,
    cell: (info) => (
      <Value>
        <AccountLink address={info.getValue()} />
      </Value>
    ),
  }),
  columnHelper.display({
    id: "tags",
    header: () => "",
    cell: (info) => <ContractTags contract={info.row.original} />,
  }),
  columnHelper.accessor("updatedAt", {
    header: () => <Label variant="medium">UPDATED</Label>,
    cell: (info) => (
      <Value>
        <TimeAgo date={info.getValue()} />
      </Value>
    ),
  }),
  columnHelper.accessor("createdAt", {
    header: () => <Label variant="medium">CREATED</Label>,
    cell: (info) => (
      <Value>
        <TimeAgo date={info.getValue()} />
      </Value>
    ),
  }),
];

function ContractTags(props: { contract: AccountContract }) {
  const { contract } = props;

  if (contract.localConfig) {
    return (
      <Tooltip
        content="This contract is located in your local project."
        position="right center"
      >
        <BaseBadge className={classes.tag}>Project contract</BaseBadge>
      </Tooltip>
    );
  } else {
    return null;
  }
}

type ContractsTableProps = {
  contracts: DecoratedPollingEntity<AccountContract>[];
};

export function ContractsTable(props: ContractsTableProps): ReactElement {
  const sortedContracts = useMemo(
    // Local project contracts should be shown first.
    () => props.contracts.sort((contract) => (contract.localConfig ? -1 : 1)),
    [props.contracts]
  );

  return (
    <BaseTable<DecoratedPollingEntity<AccountContract>>
      columns={columns}
      data={sortedContracts}
    />
  );
}