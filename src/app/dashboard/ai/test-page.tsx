// Simple test page to verify routing and rendering work
export default function AITestPage() {
  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-8 text-center">
          <div className="text-6xl mb-4">🤖</div>
          <h1 className="text-2xl font-bold font-cairo mb-2 text-slate-700">Test Page</h1>
          <p className="text-slate-500 font-cairo">الصفحة دي بتشتغل</p>
        </div>
      </div>
    </main>
  );
}
