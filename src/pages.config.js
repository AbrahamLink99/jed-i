import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Production from './pages/Production';
import Batches from './pages/Batches';
import Inventory from './pages/Inventory';
import Planning from './pages/Planning';
import Orders from './pages/Orders';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "Products": Products,
    "Production": Production,
    "Batches": Batches,
    "Inventory": Inventory,
    "Planning": Planning,
    "Orders": Orders,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};