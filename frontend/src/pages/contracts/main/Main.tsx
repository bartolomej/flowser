import React, { FunctionComponent, useEffect } from "react";
import Label from "../../../components/label/Label";
import Value from "../../../components/value/Value";
import { useNavigation } from "../../../hooks/use-navigation";
import { NavLink } from "react-router-dom";
import { useSearch } from "../../../hooks/use-search";
import { useFilterData } from "../../../hooks/use-filter-data";
import {
  useGetPollingContracts,
  useIsInitialLoad,
} from "../../../hooks/use-api";
import { createColumnHelper } from "@tanstack/table-core";
import Table from "../../../components/table/Table";
import { AccountContract } from "@flowser/shared";
import { DecoratedPollingEntity } from "contexts/timeout-polling.context";

// CONTRACTS TABLE
const columnHelper =
  createColumnHelper<DecoratedPollingEntity<AccountContract>>();

const columns = [
  columnHelper.accessor("name", {
    header: () => <Label variant="medium">NAME</Label>,
    cell: (info) => (
      <Value>
        <NavLink to={`/contracts/details/${info.row.original.id}`}>
          {info.row.original.name}
        </NavLink>
      </Value>
    ),
  }),
  columnHelper.accessor("accountAddress", {
    header: () => <Label variant="medium">ACCOUNT</Label>,
    cell: (info) => (
      <Value>
        <NavLink to={`/accounts/details/${info.getValue()}`}>
          {info.getValue()}
        </NavLink>
      </Value>
    ),
  }),
];

const Main: FunctionComponent = () => {
  const { searchTerm, setPlaceholder } = useSearch();
  const { showNavigationDrawer } = useNavigation();
  const { data, firstFetch } = useGetPollingContracts();
  const { filteredData } = useFilterData(data, searchTerm);
  const { isInitialLoad } = useIsInitialLoad();

  useEffect(() => {
    setPlaceholder("Search contracts");
    showNavigationDrawer(false);
  }, []);

  return (
    <Table<DecoratedPollingEntity<AccountContract>>
      isInitialLoading={firstFetch || isInitialLoad}
      columns={columns}
      data={filteredData}
    />
  );
};

export default Main;
