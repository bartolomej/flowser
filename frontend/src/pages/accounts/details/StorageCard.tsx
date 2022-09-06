import React, { ReactElement } from "react";
import classes from "./StorageCard.module.scss";
import { StorageBadge } from "./StorageBadge";
import { NavLink } from "react-router-dom";
import { ReactComponent as LinkIcon } from "../../../assets/icons/link.svg";
import { DecoratedPollingEntity } from "hooks/use-timeout-polling";
import { AccountStorageItem } from "@flowser/shared/dist/src/generated/entities/accounts";
import { FlowUtils } from "utils/flow-utils";

type StorageCardProps = {
  content: DecoratedPollingEntity<AccountStorageItem>;
};

export function StorageCard({ content }: StorageCardProps): ReactElement {
  const borrowType = content.data?.BorrowType ?? "-";
  const targetPathIdentifier = content.data?.TargetPath?.Identifier ?? "-";
  return (
    <div className={classes.root}>
      <div className={classes.content}>
        <StorageBadge
          text={FlowUtils.getLowerCasedPathDomain(content.pathDomain)}
        />
        <div className={classes.identifier}>{content.pathIdentifier}</div>
        <NavLink className={classes.link} to={"#"}>
          <LinkIcon />
          <div className={classes.linkText}>{targetPathIdentifier}</div>
        </NavLink>
        <span className={classes.bottomText}>{borrowType}</span>
      </div>
    </div>
  );
}
