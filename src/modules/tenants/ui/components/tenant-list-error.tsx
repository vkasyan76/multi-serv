export const TenantListError = () => (
  <div className="text-center py-8">
    <h3 className="text-lg font-semibold text-gray-900 mb-2">
      Something went wrong
    </h3>
    <p className="text-gray-600 mb-4">
      We couldn&apos;t load the providers. Please try refreshing the page.
    </p>
    <button 
      onClick={() => window.location.reload()}
      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
    >
      Refresh Page
    </button>
  </div>
);
