import { createColumnHelper } from "@tanstack/table-core";
import { DecoratedPollingEntity } from "../../contexts/timeout-polling.context";
import { AccountContract } from "@flowser/shared";
import Label from "../../components/label/Label";
import Value from "../../components/value/Value";
import { AccountLink } from "../accounts/AccountLink/AccountLink";
import ReactTimeago from "react-timeago";
import React, { ReactElement, useMemo } from "react";
import Table from "../../components/table/Table";
import { ProjectLink } from "../../components/links/ProjectLink";

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
  columnHelper.accessor("updatedAt", {
    header: () => <Label variant="medium">UPDATED</Label>,
    cell: (info) => (
      <Value>
        <ReactTimeago date={info.getValue()} />
      </Value>
    ),
  }),
  columnHelper.accessor("createdAt", {
    header: () => <Label variant="medium">CREATED</Label>,
    cell: (info) => (
      <Value>
        <ReactTimeago date={info.getValue()} />
      </Value>
    ),
  }),
];

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
    <Table<DecoratedPollingEntity<AccountContract>>
      columns={columns}
      data={sortedContracts}
    />
  );
}
