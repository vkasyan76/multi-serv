// import { ProfileForm } from "@/modules/profile/ui/ProfileForm";
import { ProfileTabs } from "@/modules/profile/ui/ProfileTabs";

const ProfilePage = () => {
  // return <ProfileForm />;
  return (
    <div className="flex justify-center items-start min-h-screen bg-[#F4F4F0]">
      <ProfileTabs />
    </div>
  );
};

export default ProfilePage;
