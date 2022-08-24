import React, { FunctionComponent } from "react";
import classes from "./EventDetailsTable.module.scss";
import Ellipsis from "../ellipsis/Ellipsis";
import CopyButton from "../copy-button/CopyButton";
import { EventUtils } from "../../utils/event-utils";

export type EventData = Record<string, any>;

export type EventDetailsTableProps = {
  data: EventData;
  className?: string;
};

const EventDetailsTable: FunctionComponent<EventDetailsTableProps> = ({
  data,
  ...restProps
}) => {
  const eventData = EventUtils.computeEventData(data);
  return (
    <div className={`${classes.root} ${restProps.className}`}>
      <div className={classes.header}>
        <div>VALUES</div>
        <div>NAME</div>
        <div>TYPE</div>
        <div>VALUE</div>
      </div>
      {eventData.map((item, index) => (
        <div key={index} className={classes.row}>
          <div></div>
          <div>
            <Ellipsis className={classes.ellipsis}>{item.name}</Ellipsis>
          </div>
          <div>
            <Ellipsis className={classes.ellipsis}>{item.type}</Ellipsis>
          </div>
          <div>
            <Ellipsis
              style={{ whiteSpace: "nowrap" }}
              className={classes.ellipsis}
            >
              {item.value}
            </Ellipsis>
            <CopyButton value={item.value} />
          </div>
        </div>
      ))}
    </div>
  );
};

export default EventDetailsTable;