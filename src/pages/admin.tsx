import AdminForm from "../components/AdminForm";
import BookingList from "../components/BookingList";

export default function Admin() {
  return (
    <div className="p-6">
      <h1 className="text-2xl mb-4">Admin — Business Settings</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <AdminForm />
        </div>
        <div>
          <BookingList />
        </div>
      </div>
    </div>
  );
}
