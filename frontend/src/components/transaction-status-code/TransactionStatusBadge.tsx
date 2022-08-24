import React, { FunctionComponent } from "react";
import classes from "./TransactionStatusCode.module.scss";
import { ReactComponent as UnknownIcon } from "../../assets/icons/status-unknown.svg";
import { ReactComponent as TransactionPendingIcon } from "../../assets/icons/status-pending.svg";
import { ReactComponent as TransactionFinalizedIcon } from "../../assets/icons/status-finalized.svg";
import { ReactComponent as TransactionExecutedIcon } from "../../assets/icons/status-executed.svg";
import { ReactComponent as TransactionSealedIcon } from "../../assets/icons/status-sealed.svg";
import { ReactComponent as TransactionExpiredIcon } from "../../assets/icons/status-expired.svg";
import { TransactionStatusCode } from "@flowser/types/generated/entities/transactions";

type TransactionStatusCodeProps = {
  statusCode: TransactionStatusCode | undefined;
};

const TransactionStatusBadge: FunctionComponent<TransactionStatusCodeProps> = ({
  statusCode,
}) => {
  // TODO(milestone-3): add tooltip for each status code
  switch (statusCode) {
    case TransactionStatusCode.UNKNOWN:
      return (
        <span className={`${classes.status} ${classes.unknown}`}>
          <UnknownIcon />
          <span>UNKNOWN</span>
        </span>
      );
    case TransactionStatusCode.PENDING:
      return (
        <span className={`${classes.status} ${classes.pending}`}>
          <TransactionPendingIcon />
          <span>PENDING</span>
        </span>
      );
    case TransactionStatusCode.FINALIZED:
      return (
        <span className={`${classes.status} ${classes.finalized}`}>
          <TransactionFinalizedIcon />
          <span>FINALIZED</span>
        </span>
      );
    case TransactionStatusCode.EXECUTED:
      return (
        <span className={`${classes.status} ${classes.executed}`}>
          <TransactionExecutedIcon />
          <span>EXECUTED</span>
        </span>
      );
    case TransactionStatusCode.SEALED:
      return (
        <span className={`${classes.status} ${classes.sealed}`}>
          <TransactionSealedIcon />
          <span>SEALED</span>
        </span>
      );
    case TransactionStatusCode.EXPIRED:
      return (
        <span className={`${classes.status} ${classes.expired}`}>
          <TransactionExpiredIcon />
          <span>EXPIRED</span>
        </span>
      );
    default:
      return <></>;
  }
};

export default TransactionStatusBadge;