import Image from "next/image";

const LoadingPage = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-transparent">
      <Image src="/loader.gif" height={150} width={150} alt="Loading..." />
    </div>
  );
};

export default LoadingPage;
