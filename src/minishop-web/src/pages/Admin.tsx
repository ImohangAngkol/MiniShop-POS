import { useState } from "react";
import { KeyRound, Plus, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { useUser } from "../App";
import type { Audit, Employee, StoreSettings } from "../types";
import { dateTime } from "../format";
import {
  Badge,
  DataForm,
  Modal,
  PageTitle,
  QueryState,
  Table,
  useAction,
  useData,
} from "../ui";

export function EmployeesPage() {
  const q = useData<Employee[]>("/employees"),
    user = useUser();
  const [adding, setAdding] = useState(false),
    [reset, setReset] = useState<Employee | null>(null);
  const create = useAction(
    (v: Record<string, string>) => api.post("/employees", v),
    "Employee account created.",
    () => setAdding(false),
  );
  const status = useAction(
    (e: Employee) =>
      api.put(`/employees/${e.id}/status`, { active: !e.active }),
    "Employee status updated.",
  );
  const password = useAction(
    (v: Record<string, string>) =>
      api.put(`/employees/${reset!.id}/password`, v),
    "Password updated. Previous sessions have been revoked.",
    () => setReset(null),
  );
  return (
    <>
      <PageTitle
        eyebrow="YOUR SHOP TEAM"
        title="Employees"
        description="The right access for the people you trust."
      >
        <button className="btn primary" onClick={() => setAdding(true)}>
          <Plus size={17} />
          Add employee
        </button>
      </PageTitle>
      <div className="panel">
        <QueryState query={q} />
        {q.data && (
          <Table headers={["Employee", "Email", "Role", "Status", "Actions"]}>
            {q.data.map((e) => (
              <tr key={e.id}>
                <td>
                  <strong>{e.displayName}</strong>
                  {e.id === user.id && <small>Your account</small>}
                </td>
                <td>{e.email}</td>
                <td>
                  <Badge tone="purple">{e.roles.join(", ")}</Badge>
                </td>
                <td>
                  <Badge tone={e.active ? "green" : "neutral"}>
                    {e.active ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td>
                  <div className="row-actions">
                    <button className="btn small" onClick={() => setReset(e)}>
                      <KeyRound size={14} />
                      Password
                    </button>
                    {e.id !== user.id && (
                      <button
                        className="btn small"
                        disabled={status.isPending}
                        onClick={() => status.mutate(e)}
                      >
                        {e.active ? "Deactivate" : "Activate"}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </div>
      <div className="info-strip">
        <ShieldCheck size={20} /> Cashiers can make sales, manage named
        customers without setting credit limits, collect repayments, and view
        their own sales. Owners manage stock, discounts, refunds, employees,
        settings, and reports.
      </div>
      {adding && (
        <Modal title="Add employee" onClose={() => setAdding(false)}>
          <DataForm
            fields={[
              { name: "displayName", label: "Display name", required: true },
              {
                name: "email",
                label: "Email address",
                type: "email",
                required: true,
              },
              {
                name: "password",
                label: "Initial password",
                type: "password",
                required: true,
                hint: "12+ characters, uppercase, lowercase, number, and symbol.",
              },
              {
                name: "role",
                label: "Role",
                type: "select",
                required: true,
                options: [
                  { value: "Cashier", label: "Cashier" },
                  { value: "Owner", label: "Owner" },
                ],
              },
            ]}
            initial={{ role: "Cashier" }}
            onSubmit={(v) => create.mutate(v)}
            pending={create.isPending}
          />
        </Modal>
      )}
      {reset && (
        <Modal
          title={`Reset password · ${reset.displayName}`}
          onClose={() => setReset(null)}
        >
          <DataForm
            fields={[
              {
                name: "password",
                label: "New password",
                type: "password",
                required: true,
                hint: "12+ characters, uppercase, lowercase, number, and symbol.",
              },
            ]}
            onSubmit={(v) => password.mutate(v)}
            pending={password.isPending}
          />
        </Modal>
      )}
    </>
  );
}
export function SettingsPage() {
  const q = useData<StoreSettings>("/settings"),
    [page, setPage] = useState(1),
    audit = useData<Audit[]>(`/settings/audit?page=${page}`);
  const save = useAction(
    (v: Record<string, string>) =>
      api.put("/settings", { ...v, thermalWidthMm: Number(v.thermalWidthMm) }),
    "Store settings saved.",
  );
  return (
    <>
      <PageTitle
        eyebrow="MAKE IT YOURS"
        title="Store settings"
        description="A few details that make every receipt feel like your shop."
      />
      <div className="form-page-grid">
        <section className="panel padded">
          <h2>Store & receipt details</h2>
          <p className="section-description">
            Changes apply when viewing and downloading sales slips.
          </p>
          <QueryState query={q} />
          {q.data && (
            <DataForm
              fields={[
                { name: "storeName", label: "Store name", required: true },
                { name: "contact", label: "Store contact" },
                { name: "address", label: "Store address", type: "textarea" },
                {
                  name: "receiptFooter",
                  label: "Receipt footer",
                  type: "textarea",
                },
                {
                  name: "thermalWidthMm",
                  label: "Thermal paper width",
                  type: "select",
                  required: true,
                  options: [
                    { value: "58", label: "58 mm" },
                    { value: "80", label: "80 mm" },
                  ],
                },
              ]}
              initial={{
                ...q.data,
                thermalWidthMm: String(q.data.thermalWidthMm),
                demoData: String(q.data.demoData),
              }}
              onSubmit={(v) => save.mutate(v)}
              pending={save.isPending}
            />
          )}
        </section>
        <aside className="info-card">
          <ShieldCheck size={28} />
          <h3>Sales slips, with clarity.</h3>
          <p>
            Generated documents are internal sales slips. They are not
            represented as BIR-compliant official invoices.
          </p>
          <p>
            Before commercial use, have a qualified adviser review current
            invoicing, tax, privacy, and record retention requirements for your
            business.
          </p>
        </aside>
      </div>
      <section className="panel spaced">
        <div className="panel-head">
          <div>
            <h2>Audit history</h2>
            <p>A record of sensitive operations</p>
          </div>
        </div>
        <QueryState query={audit} />
        {audit.data && (
          <>
            <Table headers={["Date", "Operation", "Employee ID", "Detail"]}>
              {audit.data.map((a) => (
                <tr key={a.id}>
                  <td>{dateTime(a.createdAt)}</td>
                  <td>
                    <Badge>{a.action}</Badge>
                  </td>
                  <td className="mono">{a.actorId}</td>
                  <td>{a.detail}</td>
                </tr>
              ))}
            </Table>
            <div className="pagination">
              <button
                className="btn small"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span>Page {page}</span>
              <button
                className="btn small"
                disabled={audit.data.length < 100}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
