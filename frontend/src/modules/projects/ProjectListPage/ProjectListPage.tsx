import React, { FunctionComponent, ReactElement, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import IconButton from "../../../components/buttons/IconButton/IconButton";
import longLogo from "../../../assets/images/long_logo.png";
import trash from "../../../assets/icons/trash.svg";
import classes from "./ProjectListPage.module.scss";
import { useGetAllProjects } from "../../../hooks/use-api";
import { Project } from "@flowser/shared";
import classNames from "classnames";
import moment from "moment";
import { useProjectActions } from "../../../contexts/project.context";
import { SimpleButton } from "../../../components/buttons/SimpleButton/SimpleButton";
import { ServiceRegistry } from "../../../services/service-registry";
import { useErrorHandler } from "../../../hooks/use-error-handler";
import { useAnalytics } from "../../../hooks/use-analytics";
import { AnalyticEvent } from "../../../services/analytics.service";
import { ConsentDialog } from "../../../components/overlays/dialogs/consent/ConsentDialog";
import { useAnalyticsConsent } from "../../../hooks/use-analytics-consent";
import { FlowserIcon } from "../../../components/icons/FlowserIcon";

type ProjectTab = {
  id: string;
  label: string;
  isDefault?: boolean;
  content: ReactElement;
};

const tabs: ProjectTab[] = [
  {
    id: "projects",
    label: "Projects",
    isDefault: true,
    content: <ProjectsListContent />,
  },
  {
    id: "about",
    label: "About",
    content: <AboutContent />,
  },
];

export const ProjectListPage: FunctionComponent = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const providedTabId = location.hash?.replace("#", "");
  const providedTab = tabs.find((tab) => tab.id === providedTabId);
  const defaultTab = tabs.find((tab) => tab.isDefault);
  const fallbackTab = tabs[0];
  const activeTab = providedTab ?? defaultTab ?? fallbackTab;

  return (
    <div className={classes.container}>
      <aside className={classes.sidebar}>
        <div className={classes.sideBarHeader}>
          <span className={classes.logoWrapper}>
            <img className={classes.logo} src={longLogo} alt="FLOWSER" />
          </span>
        </div>
        <ul className={classes.sideBarBody}>
          {tabs.map((tab) => (
            <li
              key={tab.id}
              className={classNames(classes.tabWrapper, {
                [classes.activeTab]: tab.id === activeTab.id,
              })}
            >
              <Link to={`/projects#${tab.id}`} className={classes.tabLink}>
                <div className={classes.indicator} />
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className={classes.sideBarFooter}>
          <IconButton
            variant="middle"
            onClick={() => navigate("/projects/create")}
            icon={<FlowserIcon.Plus />}
            iconPosition="before"
            className={classes.newProjectButton}
          >
            NEW PROJECT
          </IconButton>
        </div>
      </aside>
      {activeTab.content}
    </div>
  );
};

function ProjectsListContent() {
  const { data: projects } = useGetAllProjects();
  const { removeProject } = useProjectActions();
  const { handleError } = useErrorHandler(ProjectsListContent.name);
  const navigate = useNavigate();
  const { track } = useAnalytics();
  const projectService = ServiceRegistry.getInstance().projectsService;
  const showProjectList = projects && projects.length > 0;

  const runProject = async (project: Project) => {
    try {
      await projectService.useProject(project.id);
      track(AnalyticEvent.PROJECT_STARTED);
      navigate(`/projects/${project.id}`);
    } catch (e: unknown) {
      handleError(e);
      navigate(`/projects/${project.id}/settings`, {
        replace: true,
      });
    }
  };

  if (!showProjectList) {
    return (
      <div className={classes.bodyCenter}>
        <div>To start, you need to create a project.</div>
      </div>
    );
  }

  return (
    <div className={classes.projectList}>
      <ul className={classes.projectListBody}>
        {projects.map((project) => (
          <li key={project.id} className={classes.projectItem}>
            <span
              className={classes.projectName}
              onClick={() => runProject(project)}
            >
              {project.name}
            </span>
            <span className={classes.projectLastOpened}>
              last opened on {moment(project.updatedAt).format("DD-MM-YYYY")}
            </span>
            <SimpleButton
              className={classes.projectTrashcan}
              onClick={() => removeProject(project)}
            >
              <img src={trash} alt="trash icon" />
            </SimpleButton>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AboutContent() {
  const [showAnalyticSettings, setShowAnalyticSettings] = useState(false);
  const { isConsented, setIsConsented } = useAnalyticsConsent();
  return (
    <div className={classes.bodyCenter}>
      {showAnalyticSettings && (
        <ConsentDialog
          onClose={() => setShowAnalyticSettings(false)}
          consent={isConsented ?? true}
          setConsent={(consent) => {
            setIsConsented(consent);
            setShowAnalyticSettings(false);
          }}
        />
      )}
      <div>
        Send feedback over{" "}
        <a href="mailto:info.flowser@gmail.com" title="Flowser email">
          Email
        </a>
        <br />
        Connect with us on{" "}
        <a href="https://discord.gg/2gx7ZsRUkD" title="Flowser discord">
          Discord
        </a>
        <br />
        Follow us on{" "}
        <a href="https://twitter.com/onflowser" title="Flowser twitter">
          Twitter
        </a>{" "}
        <br />
        Contribute on{" "}
        <a href="https://github.com/onflowser/flowser" title="Flowser github">
          Github
        </a>
        <br />
        <br />
        <a
          style={{ cursor: "pointer" }}
          onClick={() => setShowAnalyticSettings(true)}
        >
          Analytic settings
        </a>
      </div>
    </div>
  );
}
