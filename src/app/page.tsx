import { Suspense } from "react";
import { AccessDeniedNotice } from "./_components/AccessDeniedNotice";
import { HomeClient } from "./_components/HomeClient";

export default function Home() {
  return (
    <>
      <Suspense fallback={null}>
        <AccessDeniedNotice />
      </Suspense>
      <HomeClient />
    </>
  );
}
