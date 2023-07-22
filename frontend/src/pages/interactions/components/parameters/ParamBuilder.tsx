import React from "react";
import { CadenceTypeKind } from "@flowser/shared";
import { ReactElement } from "react";
import { ParameterBuilder } from "./parameter-builder";
import { TextualParamBuilder } from "./TextualParamBuilder";
import { NumericParamBuilder } from "./NumericParamBuilder";
import { ArrayParamBuilder } from "./ArrayParamBuilder";

export function ParamBuilder(props: ParameterBuilder): ReactElement {
  const { parameterType } = props;
  switch (parameterType.kind) {
    case CadenceTypeKind.CADENCE_TYPE_TEXTUAL:
      return <TextualParamBuilder {...props} />;
    case CadenceTypeKind.CADENCE_TYPE_NUMERIC:
      return <NumericParamBuilder {...props} />;
    case CadenceTypeKind.CADENCE_TYPE_ARRAY:
      return <ArrayParamBuilder {...props} />;
    default:
      return <div>Unknown type</div>;
  }
}