import React, { FunctionComponent } from "react";
import { NavLink, useParams } from "react-router-dom";
import FullScreenLoading from "../../../components/fullscreen-loading/FullScreenLoading";
import { useGetContract } from "../../../hooks/use-api";
import classes from "./ContractDetails.module.scss";
import {
  DetailsCard,
  DetailsCardColumn,
} from "components/details-card/DetailsCard";
import { TextUtils } from "../../../utils/text-utils";
import { SizedBox } from "../../../components/sized-box/SizedBox";
import { CadenceEditor } from "../../../components/cadence-editor/CadenceEditor";

type ContractDetailsProps = {
  contractId: string;
};

export const ContractDetails: FunctionComponent<ContractDetailsProps> = (
  props
) => {
  const { contractId } = props;
  const { isLoading, data } = useGetContract(contractId);
  const { contract } = data ?? {};

  if (isLoading || !contract) {
    return <FullScreenLoading />;
  }

  const detailsColumns: DetailsCardColumn[] = [
    [
      {
        label: "Name",
        value: contract.name,
      },
      {
        label: "Account",
        value: (
          <NavLink to={`/accounts/details/${contract.accountAddress}`}>
            {contract.accountAddress}
          </NavLink>
        ),
      },
      {
        label: "Updated date",
        value: TextUtils.longDate(contract.updatedAt),
      },
      {
        label: "Created date",
        value: TextUtils.longDate(contract.createdAt),
      },
    ],
  ];

  return (
    <div className={classes.root}>
      <DetailsCard columns={detailsColumns} />
      <SizedBox height={30} />
      <CadenceEditor value={contract.code} editable={false} />
    </div>
  );
};