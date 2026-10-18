
const SUPABASE_URL = "https://jhlhpimabempjgyaxrwz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ngdC9veQ7ZqAxxceHCasYg_NCkQhFgY";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

const tabs = document.querySelectorAll(".stock-tab");
const tableTitle = document.getElementById("tableTitle");
const tableHeaders = document.getElementById("tableHeaders");
const tableBody = document.getElementById("tableBody");
const recordCount = document.getElementById("recordCount");
const emptyMessage = document.getElementById("emptyMessage");

let activeTab = "sales";

const columnConfig = {
    sales: {
        title: "Today Sale",
        headers: [
            "Product ID",
            "Product Name",
            "SKU",
            "Listing Date",
            "Category",
            "Purchase Price",
            "Sale Price"
        ]
    },

    low: {
        title: "Low Stock",
        headers: [
            "Product ID",
            "Product Name",
            "SKU",
            "Category",
            "Current Stock",
            "Minimum Stock",
            "Unit"
        ]
    },

    coming: {
        title: "Coming Stock",
        headers: [
            "Entry ID",
            "Product Name",
            "SKU",
            "Store Date",
            "Quantity",
            "Purchase Price",
            "Notes"
        ]
    }
};

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return escapeHTML(value);
    }

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function formatPrice(value) {
    if (value === null || value === undefined) {
        return "—";
    }

    return "₹" + Number(value).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function showLoading() {
    tableHeaders.innerHTML = `
        <tr>
            ${columnConfig[activeTab].headers
                .map(header => `<th>${escapeHTML(header)}</th>`)
                .join("")}
        </tr>
    `;

    tableBody.innerHTML = `
        <tr>
            <td colspan="${columnConfig[activeTab].headers.length}">
                Loading data...
            </td>
        </tr>
    `;

    recordCount.textContent = "Loading...";
    emptyMessage.textContent = "";
}

function showRows(rows) {
    const config = columnConfig[activeTab];

    tableTitle.textContent = config.title;

    tableHeaders.innerHTML = `
        <tr>
            ${config.headers
                .map(header => `<th>${escapeHTML(header)}</th>`)
                .join("")}
        </tr>
    `;

    recordCount.textContent = `${rows.length} records`;
    emptyMessage.textContent = "";

    if (rows.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="${config.headers.length}">
                    No records found.
                </td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = rows.map(row => `
        <tr>
            ${row.map(value => `<td>${value ?? "—"}</td>`).join("")}
        </tr>
    `).join("");
}

function showError(message) {
    tableBody.innerHTML = `
        <tr>
            <td colspan="${columnConfig[activeTab].headers.length}">
                ${escapeHTML(message)}
            </td>
        </tr>
    `;

    recordCount.textContent = "Error";
    emptyMessage.textContent =
        "Check your Supabase URL, key, table permissions and connection.";
}

async function loadTodaySales() {
    // Browser ke local date ke hisaab se aaj ka time range
    const now = new Date();

    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const { data, error } = await supabaseClient
        .from("products")
        .select(`
            product_id,
            product_name,
            sku,
            category,
            selling_price,
            sale_date,
            products (
                purchase_price
            )
        `)
        .gte("sale_date", start.toISOString())
        .lt("sale_date", end.toISOString())
        .order("sale_date", { ascending: false });

    if (error) throw error;

    return data.map(item => [
        escapeHTML(item.product_id),
        escapeHTML(item.product_name),
        escapeHTML(item.sku || "—"),
        formatDate(item.sale_date),
        escapeHTML(item.category || "—"),
        formatPrice(item.products?.purchase_price),
        formatPrice(item.selling_price)
    ]);
}

async function loadTodaySales() {
    const { data, error } = await supabaseClient
        .from("products")
        .select(`
            id,
            product_name,
            sku,
            created_at,
            category,
            purchase_price,
            selling_price
        `)
        .order("created_at", { ascending: false });

    console.log("Products data:", data);
    console.log("Products error:", error);

    if (error) {
        throw error;
    }

    return data.map(item => [
        escapeHTML(item.id),
        escapeHTML(item.product_name),
        escapeHTML(item.sku || "—"),
        formatDate(item.created_at),
        escapeHTML(item.category || "—"),
        formatPrice(item.purchase_price),
        formatPrice(item.selling_price)
    ]);
}

async function loadComingStock() {
    const { data, error } = await supabaseClient
        .from("stock_entries")
        .select(`
            id,
            store_date,
            quantity,
            purchase_price,
            notes,
            products (
                product_name,
                sku
            )
        `)
        .order("store_date", { ascending: false });

    if (error) throw error;

    return data.map(item => [
        escapeHTML(item.id),
        escapeHTML(item.products?.product_name || "—"),
        escapeHTML(item.products?.sku || "—"),
        formatDate(item.store_date),
        escapeHTML(item.quantity),
        formatPrice(item.purchase_price),
        escapeHTML(item.notes || "—")
    ]);
}

async function loadTab(tabName) {
    if (!columnConfig[tabName]) return;

    activeTab = tabName;
    showLoading();

    tableTitle.textContent = columnConfig[tabName].title;

    try {
        let rows = [];

        if (tabName === "sales") {
            rows = await loadTodaySales();
        } else if (tabName === "low") {
            rows = await loadLowStock();
        } else if (tabName === "coming") {
            rows = await loadComingStock();
        }

        // Agar user ne loading ke dauran doosra tab khol liya ho
        if (activeTab !== tabName) return;

        showRows(rows);

    } catch (error) {
        console.error("Supabase fetch error:", error);

        if (activeTab === tabName) {
            showError(error.message || "Unable to load data.");
        }
    }
}

tabs.forEach(tab => {
    tab.addEventListener("click", () => {
        tabs.forEach(button => {
            button.classList.remove("stock-active-tab");
        });

        tab.classList.add("stock-active-tab");

        loadTab(tab.dataset.tab);
    });
});

// Page open hote hi Today Sale show hoga
loadTab("sales");

/*   Search code */

const inputsearch = document.getElementById("inputsearch");

let allProducts = [];

async function loadProductsForSearch() {
    const { data, error } = await supabaseClient
        .from("products")
        .select("*")
        .order("id", { ascending: true });

    if (error) {
        console.error("Search error:", error);
        return;
    }

    allProducts = data || [];
}

inputsearch.addEventListener("input", function () {
    const searchValue = this.value.toLowerCase().trim();

    const filteredProducts = allProducts.filter(product =>
        String(product.id).includes(searchValue) ||
        (product.product_name || "").toLowerCase().includes(searchValue) ||
        (product.sku || "").toLowerCase().includes(searchValue) ||
        (product.category || "").toLowerCase().includes(searchValue)
    );

    // Existing table mein results show karein
    showRows(
        filteredProducts.map(product => [
            escapeHTML(product.id),
            escapeHTML(product.product_name),
            escapeHTML(product.sku || "—"),
            formatDate(product.created_at),
            escapeHTML(product.category || "—"),
            formatPrice(product.purchase_price),
            formatPrice(product.selling_price)
        ])
    );
});

loadProductsForSearch();


/*  show low stock    */


async function loadLowStock() {
    const { data, error } = await supabaseClient
        .from("products")
        .select(`
            id,
            product_name,
            sku,
            category,
            current_stock,
            min_stock,
            unit
        `)
        .order("current_stock", { ascending: true });

    console.log("Low stock data:", data);
    console.log("Low stock error:", error);

    if (error) {
        throw error;
    }

    const lowStockProducts = data.filter(product =>
        Number(product.current_stock) <= Number(product.min_stock)
    );

    return lowStockProducts.map(product => [
        escapeHTML(product.id),
        escapeHTML(product.product_name),
        escapeHTML(product.sku || "—"),
        escapeHTML(product.category || "—"),
        escapeHTML(product.current_stock),
        escapeHTML(product.min_stock),
        escapeHTML(product.unit)
    ]);


    recordCount.textContent =
        `${lowStockProducts.length} products`;

    emptyMessage.textContent = "";

    if (lowStockProducts.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7">No low-stock products found.</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = lowStockProducts.map(product => `
        <tr>
            <td>${escapeHTML(product.id)}</td>
            <td>${escapeHTML(product.product_name)}</td>
            <td>${escapeHTML(product.sku || "—")}</td>
            <td>${escapeHTML(product.category || "—")}</td>
            <td>${escapeHTML(product.current_stock)}</td>
            <td>${escapeHTML(product.min_stock)}</td>
            <td>${escapeHTML(product.unit)}</td>
        </tr>
    `).join("");
}

/*  data show when quantity >2 */

async function loadComingStock() {
    const { data, error } = await supabaseClient
        .from("products")
        .select(`
            id,
            product_name,
            sku,
            current_stock,
            min_stock,
            unit,
            purchase_price,
            created_at
        `)
        .lte("current_stock", 2)
        .order("current_stock", { ascending: true });

    if (error) throw error;

    return (data || []).map(item => [
        escapeHTML(item.id),
        escapeHTML(item.product_name),
        escapeHTML(item.sku || "—"),
        formatDate(item.created_at),
        escapeHTML(item.current_stock),
        formatPrice(item.purchase_price),
        escapeHTML(item.unit || "piece")
    ]);
}

