import React, { ReactElement, useEffect } from "react";
import {
  BrowserRouter,
  Redirect,
  Route,
  RouteComponentProps,
  Switch,
  withRouter,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { RouteWithLayout } from "./components/layout/Layout";
import { routes } from "./constants/routes";
import { UiStateContextProvider } from "./contexts/ui-state.context";
import { useSearch } from "./hooks/use-search";
import "./App.scss";
import { toastOptions } from "./config/toast";

// pages
import Start from "./pages/start/Start";
import Accounts from "./pages/accounts/Accounts";
import Blocks from "./pages/blocks/Blocks";
import Transactions from "./pages/transactions/Transactions";
import Contracts from "./pages/contracts/Contracts";
import Events from "./pages/events/Events";
import Logs from "./pages/logs/Logs";
import { ProjectActionsProvider } from "./contexts/project-actions.context";
import { ConfirmDialogProvider } from "./contexts/confirm-dialog.context";
import { QueryClient, QueryClientProvider } from "react-query";
import { Project } from "./pages/project/Project";
import { ProjectRequirements } from "./components/requirements/ProjectRequirements";
import { TimeoutPollingProvider } from "./contexts/timeout-polling.context";
import {
  PlatformAdapterProvider,
  PlatformAdapterState,
} from "./contexts/platform-adapter.context";

// TODO(milestone-x): temporary disabled, move analytics to a separate hook
// if (process.env.NODE_ENV !== "development") {
//   splitbee.init({
//     token: "B3B9T4Z4SRQ3",
//     disableCookie: true,
//   });
// }

const BrowserRouterEvents = withRouter(
  ({
    children,
    history,
    location,
  }: RouteComponentProps & { children: ReactElement[] }) => {
    const { setSearchTerm } = useSearch();

    history.listen((location, action) => {
      if (action === "PUSH") {
        setSearchTerm("");
      }
    });

    useEffect(() => {
      // scroll to the top on every route change
      window.scrollTo(0, 0);
    }, [location]);

    return <>{children}</>;
  }
);

const defaultQueryClient = new QueryClient();

export type FlowserClientAppProps = {
  platformAdapter?: PlatformAdapterState;
  queryClient?: QueryClient;
  enableTimeoutPolling?: boolean;
};

export const FlowserClientApp = ({
  platformAdapter,
  queryClient,
  enableTimeoutPolling = true,
}: FlowserClientAppProps): ReactElement => {
  return (
    <QueryClientProvider client={queryClient || defaultQueryClient}>
      <TimeoutPollingProvider enabled={enableTimeoutPolling}>
        <BrowserRouter>
          <ConfirmDialogProvider>
            <ProjectActionsProvider>
              <UiStateContextProvider>
                <PlatformAdapterProvider {...platformAdapter}>
                  <FlowserRoutes />
                </PlatformAdapterProvider>
              </UiStateContextProvider>
            </ProjectActionsProvider>
          </ConfirmDialogProvider>
        </BrowserRouter>
      </TimeoutPollingProvider>
    </QueryClientProvider>
  );
};

export const FlowserRoutes = (): ReactElement => {
  return (
    <BrowserRouterEvents>
      <ProjectRequirements />
      <Switch>
        <Route path={`/${routes.start}`} component={Start} />
        <RouteWithLayout path={`/${routes.accounts}`} component={Accounts} />
        <RouteWithLayout path={`/${routes.blocks}`} component={Blocks} />
        <RouteWithLayout
          path={`/${routes.transactions}`}
          component={Transactions}
        />
        <RouteWithLayout path={`/${routes.contracts}`} component={Contracts} />
        <RouteWithLayout path={`/${routes.events}`} component={Events} />
        <RouteWithLayout path={`/${routes.logs}`} component={Logs} />
        <RouteWithLayout path={`/${routes.project}`} component={Project} />
        <Redirect from="*" to={`/${routes.start}`} />
      </Switch>
      <Toaster
        position="bottom-center"
        gutter={8}
        toastOptions={toastOptions}
      />
    </BrowserRouterEvents>
  );
};
