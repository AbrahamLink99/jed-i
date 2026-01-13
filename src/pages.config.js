import Batches from './pages/Batches';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Orders from './pages/Orders';
import Planning from './pages/Planning';
import Production from './pages/Production';
import Products from './pages/Products';
import FinishedGoods from './pages/FinishedGoods';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Batches": Batches,
    "Dashboard": Dashboard,
    "Inventory": Inventory,
    "Orders": Orders,
    "Planning": Planning,
    "Production": Production,
    "Products": Products,
    "FinishedGoods": FinishedGoods,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};