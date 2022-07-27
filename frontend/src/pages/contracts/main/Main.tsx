import React, { FunctionComponent, useEffect } from "react";
import classes from "./Main.module.scss";
import Card from "../../../shared/components/card/Card";
import Label from "../../../shared/components/label/Label";
import Value from "../../../shared/components/value/Value";
import { useNavigation } from "../../../shared/hooks/navigation";
import { NavLink } from "react-router-dom";
import { useSearch } from "../../../shared/hooks/search";
import { useFilterData } from "../../../shared/hooks/filter-data";
import { useTimeoutPolling } from "../../../shared/hooks/timeout-polling";
import NoResults from "../../../shared/components/no-results/NoResults";
import FullScreenLoading from "../../../shared/components/fullscreen-loading/FullScreenLoading";

const Main: FunctionComponent<any> = () => {
  const { searchTerm, setPlaceholder } = useSearch();
  const { showNavigationDrawer, showSubNavigation } = useNavigation();
  // TODO(milestone-2): fix types
  const { data, firstFetch } = useTimeoutPolling<any>(
    "/api/contracts/polling",
    "id"
  );

  useEffect(() => {
    setPlaceholder("search for contracts");
    showNavigationDrawer(false);
    showSubNavigation(true);
  }, []);

  const { filteredData } = useFilterData(data, searchTerm);

  return (
    <>
      {filteredData &&
        filteredData.map((item: any, i) => (
          <Card
            key={item.id + i}
            className={`${classes.card} ${
              item.isNew || item.isUpdated ? classes.isNew : ""
            }`}
          >
            <div>
              <Label>NAME</Label>
              <Value>
                <NavLink to={`/contracts/details/${item.id}`}>
                  {item.name}
                </NavLink>
              </Value>
            </div>
            <div>
              <Label>ACCOUNT</Label>
              <Value>
                <NavLink to={`/accounts/details/${item.accountAddress}`}>
                  {item.accountAddress}
                </NavLink>
              </Value>
            </div>
          </Card>
        ))}
      {!firstFetch && <FullScreenLoading />}
      {firstFetch && filteredData.length === 0 && (
        <NoResults className={classes.noResults} />
      )}
    </>
  );
};

export default Main;
