import React, { createContext, useContext, useState } from "react";

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [isNotificationVisible, setIsNotificationVisible] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationType, setNotificationType] = useState("success");

  const displayNotification = (message, type = "success") => {
    setNotificationMessage(message);
    setNotificationType(type);
    setIsNotificationVisible(true);
    setTimeout(() => {
      setIsNotificationVisible(false);
    }, 3000);
  };

  const value = {
    isNotificationVisible,
    notificationMessage,
    notificationType,
    displayNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
