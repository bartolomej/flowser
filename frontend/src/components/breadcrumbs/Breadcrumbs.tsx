import React, { ReactElement, useCallback } from "react";
import { NavLink, useHistory } from "react-router-dom";
import { useNavigation } from "../../hooks/use-navigation";
import classes from "./Breadcrumbs.module.scss";
import { ReactComponent as IconBackButton } from "../../assets/icons/back-button.svg";
import classNames from "classnames";

type BreadcrumbsProps = {
  className?: string;
};

export function Breadcrumbs(props: BreadcrumbsProps): ReactElement | null {
  const { isShowBackButtonVisible, isBreadcrumbsVisible, breadcrumbs } =
    useNavigation();
  const history = useHistory();
  const currentUrl = window.location.pathname;

  const onBack = useCallback(() => {
    history.goBack();
  }, []);

  if (!isBreadcrumbsVisible) {
    return null;
  }

  return (
    <div className={classNames(classes.root, props.className)}>
      {isShowBackButtonVisible && (
        <div className={classes.backButtonWrapper} onClick={onBack}>
          <IconBackButton className={classes.backButton} />
        </div>
      )}
      <div className={classes.breadcrumbs}>
        {breadcrumbs
          .map<React.ReactNode>((item, key) => (
            <NavLink key={key} to={item.to || currentUrl}>
              {item.label}
            </NavLink>
          ))
          .reduce((prev, curr, i) => [
            prev,
            <span key={++i} className={classes.arrow}>
              {">>"}
            </span>,
            curr,
          ])}
      </div>
    </div>
  );
}
