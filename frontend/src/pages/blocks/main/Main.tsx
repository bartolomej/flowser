import React, { FunctionComponent, useEffect, useMemo } from "react";
import { NavLink } from "react-router-dom";
import { useFormattedDate } from "../../../hooks/use-formatted-date";
import { useFilterData } from "../../../hooks/use-filter-data";
import { useSearch } from "../../../hooks/use-search";
import Label from "../../../components/label/Label";
import Value from "../../../components/value/Value";
import classes from "./Main.module.scss";
import Ellipsis from "../../../components/ellipsis/Ellipsis";
import { useNavigation } from "../../../hooks/use-navigation";
import NoResults from "../../../components/no-results/NoResults";
import FullScreenLoading from "../../../components/fullscreen-loading/FullScreenLoading";
import { createColumnHelper } from "@tanstack/table-core";
import Table from "../../../components/table/Table";
import { DecoratedPollingEntity } from "../../../hooks/use-timeout-polling";
import { Block } from "@flowser/shared";
import {
  useGetPollingBlocks,
  useGetPollingEmulatorSnapshots,
} from "../../../hooks/use-api";
import toast from "react-hot-toast";
import { SimpleButton } from "../../../components/simple-button/SimpleButton";
import { ServiceRegistry } from "../../../services/service-registry";
import { useErrorHandler } from "../../../hooks/use-error-handler";

const { formatDate } = useFormattedDate();

const columnHelper = createColumnHelper<DecoratedPollingEntity<Block>>();

const Main: FunctionComponent = () => {
  const { snapshotService } = ServiceRegistry.getInstance();
  const { handleError } = useErrorHandler(Main.name);
  const { searchTerm, setPlaceholder, disableSearchBar } = useSearch();
  const { showNavigationDrawer } = useNavigation();

  const { data: blocks, firstFetch, fetchAll } = useGetPollingBlocks();
  const { data: emulatorSnapshots } = useGetPollingEmulatorSnapshots();
  const { filteredData } = useFilterData(blocks, searchTerm);
  const snapshotLookupByBlockId = useMemo(
    () =>
      new Map(
        emulatorSnapshots.map((snapshot) => [snapshot.blockId, snapshot])
      ),
    [emulatorSnapshots]
  );

  async function onRevertToBlock(blockId: string) {
    try {
      const snapshot = await snapshotService.revertTo({
        blockId,
      });
      fetchAll();
      toast.success(`Reverted to "${snapshot.snapshot?.description}"`);
    } catch (e) {
      handleError(e);
    }
  }

  useEffect(() => {
    setPlaceholder("Search for block ids, parent ids, time, ...");
    showNavigationDrawer(false);
    disableSearchBar(false);
  }, []);

  const columns = useMemo(
    () => [
      columnHelper.accessor("height", {
        header: () => <Label variant="medium">BLOCK HEIGHT</Label>,
        cell: (info) => <Value>{info.getValue()}</Value>,
      }),
      columnHelper.accessor("id", {
        header: () => <Label variant="medium">BLOCK ID</Label>,
        cell: (info) => (
          <Value>
            <NavLink to={`/blocks/details/${info.getValue()}`}>
              <Ellipsis className={classes.hash}>{info.getValue()}</Ellipsis>
            </NavLink>
          </Value>
        ),
      }),
      columnHelper.accessor("timestamp", {
        header: () => <Label variant="medium">TIME</Label>,
        cell: (info) => <Value>{formatDate(info.getValue())}</Value>,
      }),
      columnHelper.accessor("blockSeals", {
        header: () => <Label variant="medium">BLOCK SEALS</Label>,
        cell: (info) => <Value>{info.getValue()?.length}</Value>,
      }),
      columnHelper.accessor("signatures", {
        header: () => <Label variant="medium">SIGNATURES</Label>,
        cell: (info) => <Value>{info.getValue()?.length}</Value>,
      }),
      columnHelper.display({
        id: "snapshot",
        header: () => <Label variant="medium">SNAPSHOT</Label>,
        cell: (info) => {
          const block = info.row.original;
          const snapshot = snapshotLookupByBlockId.get(block.id);
          return (
            <Value>
              {snapshot ? (
                <SimpleButton onClick={() => onRevertToBlock(block.id)}>
                  {snapshot.description}
                </SimpleButton>
              ) : (
                "-"
              )}
            </Value>
          );
        },
      }),
    ],
    [filteredData, snapshotLookupByBlockId]
  );

  return (
    <>
      {!firstFetch && <FullScreenLoading />}
      {firstFetch && filteredData.length === 0 && (
        <NoResults className={classes.noResults} />
      )}
      {filteredData.length > 0 && (
        <Table<DecoratedPollingEntity<Block>>
          columns={columns}
          data={filteredData}
        ></Table>
      )}
    </>
  );
};

export default Main;
