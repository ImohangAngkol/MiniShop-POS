import { useState } from "react";
import axios from "axios";
import { ArrowDownLeft, Plus, Search, Wallet } from "lucide-react";
import { useUser } from "../App";
import { api } from "../api";
import type { Customer, Ledger } from "../types";
import { dateTime, money } from "../format";
import {
  Badge,
  DataForm,
  Empty,
  Modal,
  PageTitle,
  QueryState,
  Table,
  useAction,
  useData,
} from "../ui";
import type { Field } from "../ui";

export function CustomersPage({ credit = false }: { credit?: boolean }) {
  const [search, setSearch] = useState(""),
    [editing, setEditing] = useState<Customer | "new" | null>(null),
    [selected, setSelected] = useState<Customer | null>(null),
    [repaying, setRepaying] = useState<Customer | null>(null);
  const owner = useUser().roles.includes("Owner"),
    q = useData<Customer[]>(`/customers?search=${encodeURIComponent(search)}`);
  const save = useAction(
    async (v: Record<string, string>) => {
      const body = {
        name: v.name,
        contact: v.contact || null,
        creditLimit: v.creditLimit ? Number(v.creditLimit) : null,
        active: v.active !== "false",
      };
      if (editing && editing !== "new")
        await api.put(`/customers/${editing.id}`, body);
      else await api.post("/customers", body);
    },
    "Customer account saved.",
    () => setEditing(null),
  );
  const fields: Field[] = [
    { name: "name", label: "Customer name", required: true },
    {
      name: "contact",
      label: "Contact information",
      hint: "Optional. Collect only what your shop needs.",
    },
    ...(owner
      ? ([
          {
            name: "creditLimit",
            label: "Credit limit (PHP)",
            type: "number",
            min: 0,
            max: 99999999,
            step: "0.01",
            hint: "Leave blank for no configured limit.",
          },
          {
            name: "active",
            label: "Account status",
            type: "select",
            required: true,
            options: [
              { value: "true", label: "Active" },
              { value: "false", label: "Inactive" },
            ],
          },
        ] as Field[])
      : []),
  ];
  const list = q.data?.filter((c) => !credit || c.balance > 0);
  return (
    <>
      <PageTitle
        eyebrow={credit ? "A LITTLE TRUST, WELL MANAGED" : "FAMILIAR FACES"}
        title={credit ? "Utang accounts" : "Your customers"}
        description={
          credit
            ? "Clear balances and a complete history of every payment."
            : "Keep the people behind your everyday business close."
        }
      >
        <button className="btn primary" onClick={() => setEditing("new")}>
          <Plus size={17} />
          Add customer
        </button>
      </PageTitle>
      {credit && (
        <div className="credit-summary">
          <span className="quick-icon purple">
            <Wallet />
          </span>
          <div>
            <span>Outstanding in this view</span>
            <strong>
              {money(list?.reduce((sum, c) => sum + c.balance, 0) ?? 0)}
            </strong>
          </div>
          <p>
            Repayments reduce credit balances.
            <br />
            They do not create new sales revenue.
          </p>
        </div>
      )}
      <div className="panel">
        <div className="toolbar">
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="Search customers"
              placeholder="Find a customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <span className="muted">{list?.length ?? 0} accounts</span>
        </div>
        <QueryState query={q} />
        {list &&
          (list.length ? (
            <Table
              headers={[
                "Customer",
                "Contact",
                "Outstanding",
                "Credit limit",
                "Status",
                "Actions",
              ]}
            >
              {list.map((c) => (
                <tr key={c.id}>
                  <td>
                    <button
                      className="name-button"
                      onClick={() => setSelected(c)}
                    >
                      {c.name}
                    </button>
                  </td>
                  <td>{c.contact || "—"}</td>
                  <td
                    className={`amount ${c.balance > 0 ? "orange-text" : ""}`}
                  >
                    {money(c.balance)}
                  </td>
                  <td>
                    {c.creditLimit == null ? "No limit" : money(c.creditLimit)}
                  </td>
                  <td>
                    <Badge tone={c.active ? "green" : "neutral"}>
                      {c.active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="btn small"
                        onClick={() => setSelected(c)}
                      >
                        Ledger
                      </button>
                      {owner && (
                        <button
                          className="btn small"
                          onClick={() => setEditing(c)}
                        >
                          Edit
                        </button>
                      )}
                      {c.balance > 0 && (
                        <button
                          className="btn small primary"
                          onClick={() => setRepaying(c)}
                        >
                          <ArrowDownLeft size={14} />
                          Repay
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty
              title={
                credit ? "All settled up" : "Say hello to your first customer"
              }
              text={
                credit
                  ? "No outstanding balances match this view."
                  : "Create a named account to record customer credit."
              }
            />
          ))}
      </div>
      <p className="page-note">
        Search to narrow the latest 500 matching accounts. Historical credit
        entries are retained when accounts change.
      </p>
      {editing && (
        <Modal
          title={editing === "new" ? "Add customer" : "Edit customer"}
          onClose={() => setEditing(null)}
        >
          <DataForm
            fields={fields}
            initial={
              editing === "new"
                ? { active: "true" }
                : {
                    name: editing.name,
                    contact: editing.contact ?? "",
                    creditLimit: editing.creditLimit?.toString() ?? "",
                    active: String(editing.active),
                  }
            }
            onSubmit={(v) => save.mutate(v)}
            pending={save.isPending}
          />
        </Modal>
      )}
      {selected && (
        <Modal title={selected.name} onClose={() => setSelected(null)}>
          <CustomerLedger customer={selected} />
        </Modal>
      )}
      {repaying && (
        <Modal
          title={`Repayment · ${repaying.name}`}
          onClose={() => setRepaying(null)}
        >
          <Repayment customer={repaying} onDone={() => setRepaying(null)} />
        </Modal>
      )}
    </>
  );
}
function CustomerLedger({ customer }: { customer: Customer }) {
  const q = useData<Ledger>(`/customers/${customer.id}/ledger`);
  return (
    <>
      <QueryState query={q} />
      {q.data && (
        <>
          <div className="ledger-balance">
            <span>Outstanding balance</span>
            <strong>{money(q.data.balance)}</strong>
          </div>
          {q.data.items.length ? (
            <Table headers={["Date / reference", "Type", "Amount"]}>
              {q.data.items.map((e) => (
                <tr key={e.id}>
                  <td>
                    <strong>{e.reference}</strong>
                    <small>{dateTime(e.createdAt)}</small>
                  </td>
                  <td>
                    <Badge tone={e.amount > 0 ? "orange" : "green"}>
                      {e.kind}
                    </Badge>
                  </td>
                  <td className="amount">
                    {e.amount > 0 ? "+" : ""}
                    {money(e.amount)}
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty
              title="No credit activity"
              text="Credit sales and repayments will appear here."
            />
          )}
          <p className="page-note">
            Latest 500 ledger entries. Positive amounts are charges; negative
            amounts reduce the balance.
          </p>
        </>
      )}
    </>
  );
}
function Repayment({
  customer,
  onDone,
}: {
  customer: Customer;
  onDone: () => void;
}) {
  const user = useUser(),
    storageKey = `minishop-repayment-${user.id}-${customer.id}`;
  const [saved, setSaved] = useState<{
    requestId: string;
    amount: string;
  } | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
    } catch {
      return null;
    }
  });
  const savedAmount = saved?.amount;
  const repayment = useAction(
    async (v: Record<string, string>) => {
      const intent = saved ?? {
        requestId: crypto.randomUUID(),
        amount: v.amount,
      };
      sessionStorage.setItem(storageKey, JSON.stringify(intent));
      setSaved(intent);
      try {
        await api.post(`/customers/${customer.id}/repayments`, {
          requestId: intent.requestId,
          amount: Number(intent.amount),
        });
      } catch (e) {
        if (
          axios.isAxiosError(e) &&
          e.response &&
          [400, 401, 403, 409, 422].includes(e.response.status)
        ) {
          sessionStorage.removeItem(storageKey);
          setSaved(null);
        }
        throw e;
      }
    },
    "Repayment recorded.",
    () => {
      sessionStorage.removeItem(storageKey);
      onDone();
    },
  );
  return (
    <>
      <p className="modal-description">
        Outstanding: <strong>{money(customer.balance)}</strong>. Payments are
        allocated to the oldest unsettled sales.
      </p>
      {savedAmount ? (
        <div className="pending-notice">
          Payment of {money(savedAmount)} is awaiting confirmation. Retry uses
          the same request key.
          <button
            className="btn primary"
            disabled={repayment.isPending}
            onClick={() => repayment.mutate({ amount: savedAmount })}
          >
            Retry payment
          </button>
        </div>
      ) : (
        <DataForm
          fields={[
            {
              name: "amount",
              label: "Amount paid (PHP)",
              type: "number",
              min: 0.01,
              max: customer.balance,
              step: "0.01",
              required: true,
            },
          ]}
          onSubmit={(v) => repayment.mutate(v)}
          pending={repayment.isPending}
          submit="Record repayment"
        />
      )}
    </>
  );
}
