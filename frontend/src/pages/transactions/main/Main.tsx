import React, { FunctionComponent, useEffect } from "react";
import classes from "./Main.module.scss";
import { useNavigation } from "../../../hooks/use-navigation";
import { useSearch } from "../../../hooks/use-search";
import { useFilterData } from "../../../hooks/use-filter-data";
import NoResults from "../../../components/no-results/NoResults";
import FullScreenLoading from "../../../components/fullscreen-loading/FullScreenLoading";
import { useGetPollingTransactions } from "../../../hooks/use-api";
import { createColumnHelper } from "@tanstack/table-core";
import { DecoratedPollingEntity } from "../../../hooks/use-timeout-polling";
import { Transaction } from "@flowser/shared";
import Label from "../../../components/label/Label";
import Value from "../../../components/value/Value";
import { NavLink } from "react-router-dom";
import Ellipsis from "../../../components/ellipsis/Ellipsis";
import Table from "../../../components/table/Table";
import { ExecutionStatus } from "components/status/ExecutionStatus";

// TRANSACTIONS TABLE
const columnHelper = createColumnHelper<DecoratedPollingEntity<Transaction>>();

const columns = [
  columnHelper.accessor("id", {
    header: () => <Label variant="medium">TRANSACTION ID</Label>,
    cell: (info) => (
      <Value>
        <NavLink to={`/transactions/details/${info.getValue()}`}>
          <Ellipsis className={classes.hash}>{info.getValue()}</Ellipsis>
        </NavLink>
      </Value>
    ),
  }),
  columnHelper.accessor("blockId", {
    header: () => <Label variant="medium">BLOCK ID</Label>,
    cell: (info) => (
      <Value>
        <NavLink to={`/blocks/details/${info.getValue()}`}>
          <Ellipsis className={classes.hash}>{info.getValue()}</Ellipsis>
        </NavLink>
      </Value>
    ),
  }),
  columnHelper.accessor("payer", {
    header: () => <Label variant="medium">PAYER</Label>,
    cell: (info) => (
      <Value>
        <NavLink to={`/accounts/details/${info.getValue()}`}>
          <Ellipsis className={classes.hash}>{info.getValue()}</Ellipsis>
        </NavLink>
      </Value>
    ),
  }),
  columnHelper.accessor("proposalKey", {
    header: () => <Label variant="medium">PROPOSER</Label>,
    cell: (info) => (
      <Value>
        {info.getValue() ? (
          <NavLink
            to={`/accounts/details/${info.row.original.proposalKey?.address}`}
          >
            {info.row.original.proposalKey?.address}
          </NavLink>
        ) : (
          "-"
        )}
      </Value>
    ),
  }),
  columnHelper.accessor("status", {
    header: () => <Label variant="medium">STATUS</Label>,
    cell: (info) => (
      <div>
        <ExecutionStatus status={info.getValue()} />
      </div>
    ),
  }),
];

const Main: FunctionComponent = () => {
  const { searchTerm, setPlaceholder, disableSearchBar } = useSearch();
  const { showNavigationDrawer } = useNavigation();
  const { data, firstFetch } = useGetPollingTransactions();
  const { filteredData } = useFilterData(data, searchTerm);

  useEffect(() => {
    setPlaceholder("search for block numbers or tx hashes");
    showNavigationDrawer(false);
    disableSearchBar(!data.length);
  }, [data]);

  return (
    <>
      <Table<DecoratedPollingEntity<Transaction>>
        data={filteredData}
        columns={columns}
      />
      {!firstFetch && <FullScreenLoading />}
      {firstFetch && filteredData.length === 0 && (
        <NoResults className={classes.noResults} />
      )}
    </>
  );
};

export default Main;
