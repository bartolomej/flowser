import React, { FunctionComponent, useEffect } from "react";
import { NavLink, useParams } from "react-router-dom";
import Label from "../../../components/label/Label";
import Value from "../../../components/value/Value";
import DetailsCard from "../../../components/details-card/DetailsCard";
import ContentDetailsScript from "../../../components/content-details-script/ContentDetailsScript";
import { Breadcrumb, useNavigation } from "../../../hooks/use-navigation";
import FullScreenLoading from "../../../components/fullscreen-loading/FullScreenLoading";
import { useGetContract } from "../../../hooks/use-api";

type RouteParams = {
  contractId: string;
};

const Details: FunctionComponent = () => {
  const { contractId } = useParams<RouteParams>();
  const { setBreadcrumbs, showSearchBar } = useNavigation();
  const { showNavigationDrawer, showSubNavigation } = useNavigation();
  const { isLoading, data } = useGetContract(contractId);
  const { contract } = data ?? {};

  const breadcrumbs: Breadcrumb[] = [
    { to: "/contracts", label: "Contracts" },
    { label: "Details" },
  ];

  useEffect(() => {
    showNavigationDrawer(true);
    showSubNavigation(false);
    setBreadcrumbs(breadcrumbs);
    showSearchBar(false);
  }, []);

  if (isLoading || !contract) {
    return <FullScreenLoading />;
  }

  return (
    <div>
      <DetailsCard>
        <div>
          <Label variant="large">NAME</Label>
          <Value variant="large">{contract.name}</Value>
        </div>
        <div>
          <Label variant="large">ACCOUNT</Label>
          <Value variant="large">
            <NavLink to={`/accounts/details/${contract.accountAddress}`}>
              {contract.accountAddress}
            </NavLink>
          </Value>
        </div>
      </DetailsCard>
      <ContentDetailsScript script={contract.code} />
    </div>
  );
};

export default Details;
