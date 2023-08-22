import React, { ReactElement, useEffect } from "react";
import { CadenceValueBuilder } from "../interface";
import { FclValues } from "@flowser/shared";
import SelectInput from "../../../../../../components/inputs/select-input/SelectInput";

export function BoolBuilder(props: CadenceValueBuilder): ReactElement {
  const { value, setValue } = props;

  const isInitialised = FclValues.isFclBoolValue(value);

  // TODO(polish): Don't trigger this hook on every rerender
  //  See: https://www.notion.so/flowser/Sometimes-arguments-don-t-get-initialized-properly-80c34018155646d08e4da0bc6c977ed9?pvs=4
  useEffect(() => {
    if (!isInitialised) {
      setValue(false);
    }
  });

  if (!isInitialised) {
    return <></>;
  }

  return (
    <SelectInput
      value={String(value)}
      options={[
        {
          value: "true",
          label: "True",
        },
        {
          value: "false",
          label: "False",
        },
      ]}
      onChange={(event) => {
        switch (event.target.value) {
          case "true":
            return setValue(true);
          case "false":
            return setValue(false);
          default:
            throw new Error(
              "Unknown selected option Value: " + event.target.value
            );
        }
      }}
    />
  );
}
