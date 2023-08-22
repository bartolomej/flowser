import React, { FunctionComponent, useEffect } from "react";
import { Breadcrumb, useNavigation } from "../../../hooks/use-navigation";
import classes from "./Details.module.scss";
import { useParams } from "react-router-dom";
import FullScreenLoading from "../../../components/fullscreen-loading/FullScreenLoading";
import {
  useGetAccount,
  useGetPollingContractsByAccount,
  useGetPollingKeysByAccount,
  useGetPollingTransactionsByAccount,
} from "../../../hooks/use-api";
import { TableCard, DetailsCardColumn } from "components/cards/table/TableCard";
import { TextUtils } from "../../../utils/text-utils";
import { SizedBox } from "@flowser/ui";
import { AccountAvatar } from "@flowser/ui";
import { AccountName } from "@flowser/ui";
import { StyledTabs } from "@flowser/ui";
import { AccountStorage } from "./storage/AccountStorage";
import { TransactionsTable } from "../../transactions/main/TransactionsTable";
import { ContractsTable } from "../../contracts/main/ContractsTable";
import { KeysTable } from "./KeysTable";
import { CadenceEditor } from "@flowser/ui";

export type AccountDetailsRouteParams = {
  accountId: string;
};

const Details: FunctionComponent = () => {
  const { accountId } = useParams<AccountDetailsRouteParams>();
  const { setBreadcrumbs } = useNavigation();
  const { showNavigationDrawer } = useNavigation();
  const { data, isLoading } = useGetAccount(accountId);
  const { data: transactions } = useGetPollingTransactionsByAccount(accountId);
  const { data: contracts } = useGetPollingContractsByAccount(accountId);
  const { data: keys } = useGetPollingKeysByAccount(accountId);
  const { account } = data ?? {};

  const breadcrumbs: Breadcrumb[] = [
    { to: "/accounts", label: "Accounts" },
    { label: "Details" },
  ];

  useEffect(() => {
    showNavigationDrawer(true);
    setBreadcrumbs(breadcrumbs);
  }, []);

  if (isLoading || !account) {
    return <FullScreenLoading />;
  }

  const detailsColumns: DetailsCardColumn[] = [
    [
      {
        label: "Address",
        value: (
          <>
            <AccountAvatar address={account.address} />
            <SizedBox width={10} />
            <AccountName address={account.address} />
          </>
        ),
      },
      {
        label: "Balance",
        value: (
          <>
            {account.balance}
            <span className={classes.currency}>FLOW</span>
          </>
        ),
      },
      {
        label: "Created date",
        value: TextUtils.longDate(account.createdAt),
      },
    ],
  ];

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <TableCard className={classes.detailsCard} columns={detailsColumns} />
      </div>
      <SizedBox height={30} />
      <StyledTabs
        tabs={[
          {
            id: "storage",
            label: "Storage",
            content: <AccountStorage account={account} />,
          },
          {
            id: "transactions",
            label: "Transactions",
            content: <TransactionsTable transactions={transactions} />,
          },
          {
            id: "contracts",
            label: "Contracts",
            content: <ContractsTable contracts={contracts} />,
          },
          {
            id: "keys",
            label: "Keys",
            content: <KeysTable keys={keys} />,
          },
          {
            id: "scripts",
            label: "Scripts",
            content: <CadenceEditor value={account.code} editable={false} />,
          },
        ]}
      />
    </div>
  );
};

export default Details;
