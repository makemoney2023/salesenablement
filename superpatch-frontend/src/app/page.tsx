import { redirect } from "next/navigation";

// Home page redirects to Call Center
export default function Home() {
  redirect('/campaign');
}
