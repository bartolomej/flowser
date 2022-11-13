import React, {
  createContext,
  Dispatch,
  FunctionComponent,
  SetStateAction,
  useContext,
  useState,
} from "react";
import { LogDrawerUiState } from "../hooks/use-log-drawer";
import { NavigationUiState } from "../hooks/use-navigation";

export interface UiState extends LogDrawerUiState, NavigationUiState {
  placeholder: { [key: string]: string };
  searchTerm: { [key: string]: string };
  searchDisabled: boolean;
}

export const defaultUiState: UiState = {
  placeholder: { default: "Search" },
  searchTerm: { default: "" },
  searchDisabled: false,
  logDrawerSize: "tiny",
  breadcrumbs: [],
  isBreadcrumbsVisible: false,
  isShowBackButtonVisible: true,
  isSearchBarVisible: true,
};

type UiStateContext = [UiState, Dispatch<SetStateAction<UiState>>];

const UiStateContext = createContext<UiStateContext>([
  defaultUiState,
  () => undefined,
]);

export function useUiStateContext(): UiStateContext {
  return useContext<UiStateContext>(UiStateContext);
}
export const UiStateContextProvider: FunctionComponent = ({ children }) => {
  const [state, setState] = useState<UiState>(defaultUiState);
  return (
    <UiStateContext.Provider value={[state, setState]}>
      {children}
    </UiStateContext.Provider>
  );
};
