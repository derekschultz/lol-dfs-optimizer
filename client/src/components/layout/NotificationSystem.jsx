import React from "react";
import { useNotification } from "../../contexts/NotificationContext";

const NotificationSystem = () => {
  const { isNotificationVisible, notificationMessage, notificationType } =
    useNotification();

  if (!isNotificationVisible) {
    return null;
  }

  return (
    <div className={`notification notification-${notificationType}`}>
      {notificationMessage}
    </div>
  );
};

export default NotificationSystem;
