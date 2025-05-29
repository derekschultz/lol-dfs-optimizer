import React from "react";
import Header from "./Header";
import TabNavigation from "./TabNavigation";
import NotificationSystem from "./NotificationSystem";
import LoadingOverlay from "./LoadingOverlay";
import Footer from "./Footer";

const AppLayout = ({ children }) => {
  return (
    <div>
      <Header />
      <main className="container">
        <TabNavigation />
        {children}
      </main>
      <Footer />
      <LoadingOverlay />
      <NotificationSystem />
    </div>
  );
};

export default AppLayout;
