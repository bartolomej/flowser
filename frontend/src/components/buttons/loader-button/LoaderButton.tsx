import React, { ReactElement, useState } from "react";
import { SimpleButtonProps } from "../simple-button/SimpleButton";
import { Spinner } from "../../spinner/Spinner";
import { PrimaryButton } from '../primary-button/PrimaryButton';

type LoaderButtonProps = Omit<SimpleButtonProps, "onClick"> & {
  onClick: () => Promise<void>;
  loadingContent?: string;
};

export function LoaderButton(props: LoaderButtonProps): ReactElement {
  const {
    onClick,
    loadingContent = "Loading",
    children,
    ...simpleButtonProps
  } = props;
  const [isLoading, setIsLoading] = useState(false);

  return (
    <PrimaryButton
      {...simpleButtonProps}
      onClick={async () => {
        try {
          setIsLoading(true);
          await onClick();
        } finally {
          setIsLoading(false);
        }
      }}
    >
      {isLoading ? (
        <div
          style={{ display: "flex", columnGap: 10, justifyContent: "center" }}
        >
          <Spinner size={15} />
          {loadingContent}
        </div>
      ) : (
        children
      )}
    </PrimaryButton>
  );
}
