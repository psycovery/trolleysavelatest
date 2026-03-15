{user ? (
  <div className="hidden sm:flex items-center gap-2">
    <Link href="/seller" className="btn btn-outline btn-sm">Dashboard</Link>
    <button
      onClick={async () => {
        await supabase.auth.signOut()
        window.location.href = '/'
      }}
      className="btn btn-outline btn-sm text-gray-500"
    >
      Log out
    </button>
  </div>
) : (
  <Link href="/auth/login" className="btn btn-outline btn-sm hidden sm:flex">Log in</Link>
)}
