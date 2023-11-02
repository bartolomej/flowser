import React from 'react';
import { ActionDialog } from '@onflowser/ui/src/common/overlays/dialogs/action/ActionDialog';
import { ReactElement } from 'react';
import classes from './DependencyErrors.module.scss';
import {
  FlowserDependencyError,
  FlowserDependencyErrorType,
} from '../../../services/types';
import useSWR, { SWRResponse } from 'swr';

export function DependencyErrors(): ReactElement | null {
  const { data: errors } = useGetDependencyErrors();
  const showModal = errors && errors.length > 0;

  if (!showModal) {
    return null;
  }

  return (
    <ActionDialog title="Before you start Flowsing 🌊" onClose={() => null}>
      {errors.map((error) => (
        <div key={error.name} className={classes.missingRequirementItem}>
          <b className={classes.title}>{error.name}</b>
          <Description error={error} />
        </div>
      ))}
    </ActionDialog>
  );
}

function useGetDependencyErrors(): SWRResponse<FlowserDependencyError[]> {
  return useSWR(`dependency-errors`, () =>
    window.electron.app.listDependencyErrors(),
  );
}

function Description(props: { error: FlowserDependencyError }) {
  const { unsupportedCliVersion, type } = props.error;

  switch (type) {
    case FlowserDependencyErrorType.UNSUPPORTED_CLI_VERSION:
      return (
        <div>
          <p className={classes.description}>
            Found <code>flow-cli@{unsupportedCliVersion?.actualVersion}</code>,
            but the minimum required version is{' '}
            <code>flow-cli@{unsupportedCliVersion?.minSupportedVersion}</code>.
          </p>
          <p className={classes.description}>
            Please update flow-cli too to the latest version to use Flowser. See
            the{' '}
            <a
              href="https://developers.flow.com/tools/flow-cli/install"
              target="_blank"
              rel="noreferrer"
            >
              installation instructions
            </a>{' '}
            to learn more.
          </p>
        </div>
      );
    case FlowserDependencyErrorType.MISSING_FLOW_CLI:
      return (
        <div>
          <p className={classes.description}>
            We couldn{`'`}t find a flow-cli installation on your machine.
          </p>
          <p className={classes.description}>
            Please install flow-cli to use Flowser. See the{' '}
            <a
              href="https://developers.flow.com/tools/flow-cli/install"
              target="_blank"
              rel="noreferrer"
            >
              installation instructions
            </a>{' '}
            to learn more.
          </p>
        </div>
      );
    default:
      return <div>Unknown</div>;
  }
}
