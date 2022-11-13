import React, { ReactElement } from "react";
import classes from "./BaseStorageCard.module.scss";
import { AccountStorageItem } from "@flowser/shared/dist/src/generated/entities/accounts";
import { FlowUtils } from "utils/flow-utils";
import classNames from "classnames";
import ReactJson from "react-json-view";
import { SimpleButton } from "../../../components/simple-button/SimpleButton";
import { DecoratedPollingEntity } from "contexts/timeout-polling.context";

type ExtendableStorageCardProps = {
  storageItem: DecoratedPollingEntity<AccountStorageItem>;
  onToggleExpand: () => void;
  isExpanded: boolean;
  className?: string;
};

export function BaseStorageCard({
  storageItem,
  onToggleExpand,
  isExpanded,
  className,
}: ExtendableStorageCardProps): ReactElement {
  const extendClass = classNames(className, {
    [classes.root]: true,
    [classes.gridItemExtended]: isExpanded,
    [classes.introAnimation]: storageItem.isNew || storageItem.isUpdated,
  });

  const storageDataPaths = getDataTypeKeysInStorageData(storageItem.data);

  return (
    <div id={storageItem.id} className={extendClass}>
      <SimpleButton className={classes.header} onClick={() => onToggleExpand()}>
        <div className={classes.type}>
          {FlowUtils.getLowerCasedPathDomain(storageItem.pathDomain)}
        </div>
        <div className={classes.circle}>
          <div className={classes.icon}>{isExpanded ? "-" : "+"}</div>
        </div>
      </SimpleButton>
      <div className={classes.body}>
        <div className={classes.title}>{storageItem.pathIdentifier}</div>
        {isExpanded ? (
          <div className={classes.json}>
            <ReactJson
              style={{ backgroundColor: "none" }}
              theme="ashes"
              collapsed={4}
              src={storageItem.data as Record<string, unknown>}
            />
          </div>
        ) : (
          <div className={classes.tags}>
            {storageDataPaths.map((path) => (
              <div key={path} className={classes.badge}>
                {path}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getDataTypeKeysInStorageData(
  storageData: Record<string, unknown> | undefined
): string[] {
  const nestedObjectsKeys = Object.keys(storageData ?? {});
  const uniqueDataTypes = new Set<string>();
  const addAll = (values: string[]) =>
    values.forEach((value) => uniqueDataTypes.add(value));

  addAll(getDataTypeKeysAtCurrentDepth(storageData));

  // Find all data type keys that are stored in nested objects
  for (const key of nestedObjectsKeys) {
    const nestedObjectCandidate = storageData?.[key] as
      | Record<string, unknown>
      | undefined;
    const isValidCandidate =
      typeof nestedObjectCandidate === "object" &&
      nestedObjectCandidate !== null;
    if (isValidCandidate) {
      const nestedDataTypeKeys = getDataTypeKeysInStorageData(
        nestedObjectCandidate
      );
      addAll(nestedDataTypeKeys);
    }
  }
  return [...uniqueDataTypes];
}

function getDataTypeKeysAtCurrentDepth(
  storageData: Record<string, unknown> | undefined
): string[] {
  const compositeDataTypeKeyPattern = /[a-zA-Z]+Type/;
  const keys = Object.keys(storageData ?? {});
  const compositeDataTypes = keys.filter((key) =>
    compositeDataTypeKeyPattern.test(key)
  );
  const simpleDataTypes =
    storageData !== undefined && "value" in storageData
      ? [typeof storageData.value]
      : [];
  return [...compositeDataTypes, ...simpleDataTypes];
}
