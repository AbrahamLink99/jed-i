import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, ChefHat, Edit2, Trash2, Shield } from 'lucide-react';
import { cn } from "@/lib/utils";
import RecipeForm from '@/components/recipes/RecipeForm';
import { toast } from 'sonner';
import { usePermissions } from '@/components/auth/PermissionGate';
import { useEnvironmentFilter } from '@/components/environment/useEnvironmentFilter';

export default function Recipes() {
  const { isAdmin, loading: permissionsLoading } = usePermissions();
  const envFilter = useEnvironmentFilter();
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);

  const queryClient = useQueryClient();

  const { data: products = [] } = useQuery({
    queryKey: ['products', envFilter.environment],
    queryFn: () => base44.entities.Product.filter(envFilter),
    enabled: !permissionsLoading && isAdmin
  });

  const { data: bomItems = [] } = useQuery({
    queryKey: ['bom-items', envFilter.environment],
    queryFn: () => base44.entities.BOMItem.filter(envFilter),
    enabled: !permissionsLoading && isAdmin
  });

  // Group BOM items by finished product
  const recipes = useMemo(() => {
    const finishedGoods = products.filter(p => p.type === 'finished_good');
    return finishedGoods.map(fg => {
      const components = bomItems
        .filter(bom => bom.finished_product_id === fg.id)
        .map(bom => {
          const component = products.find(p => p.id === bom.component_id);
          return {
            ...bom,
            component_sku: component?.sku,
            component_name: component?.name,
            component_unit: component?.unit,
            component_type: component?.type
          };
        });
      
      return {
        ...fg,
        components,
        hasRecipe: components.length > 0
      };
    });
  }, [products, bomItems]);

  const filteredRecipes = useMemo(() => {
    return recipes.filter(r => {
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return r.sku?.toLowerCase().includes(search) || 
               r.name?.toLowerCase().includes(search);
      }
      return true;
    }).sort((a, b) => a.sku?.localeCompare(b.sku));
  }, [recipes, searchTerm]);

  const deleteRecipeMutation = useMutation({
    mutationFn: async (productId) => {
      const items = bomItems.filter(b => b.finished_product_id === productId);
      for (const item of items) {
        await base44.entities.BOMItem.delete(item.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bom-items'] });
      toast.success('Recept raderat');
    }
  });

  const handleEdit = (recipe) => {
    setEditingRecipe(recipe);
    setShowForm(true);
  };

  const handleDelete = (recipe) => {
    if (confirm(`Vill du radera receptet för ${recipe.name}?`)) {
      deleteRecipeMutation.mutate(recipe.id);
    }
  };

  const availableComponents = products.filter(p => 
    p.type === 'raw_material' || p.type === 'packaging' || p.type === 'label'
  );

  if (permissionsLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-600">Laddar...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-red-500" />
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Ingen åtkomst</h2>
          <p className="text-slate-600">
            Du har inte behörighet att visa recept. Endast administratörer kan se och hantera recept.
          </p>
        </Card>
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <RecipeForm
            recipe={editingRecipe}
            availableProducts={products}
            availableComponents={availableComponents}
            onClose={() => {
              setShowForm(false);
              setEditingRecipe(null);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Recept</h1>
            <p className="text-slate-500 mt-1">Skapa och hantera produktionsrecept (BOM)</p>
          </div>
          <Button 
            onClick={() => setShowForm(true)} 
            className="bg-indigo-600 hover:bg-indigo-700"
            disabled={availableComponents.length === 0}
          >
            <Plus className="w-4 h-4 mr-2" />
            Skapa recept
          </Button>
        </div>

        {availableComponents.length === 0 && (
          <Card className="p-6 mb-6 border-amber-200 bg-amber-50">
            <div className="flex items-start gap-3">
              <ChefHat className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-amber-900">Lägg till råvaror först</h3>
                <p className="text-sm text-amber-700 mt-1">
                  Du måste först lägga till råvaror, förpackningar eller etiketter i systemet innan du kan skapa recept. 
                  Gå till Produkter-sidan för att lägga till komponenter.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Search */}
        <Card className="p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Sök färdigvara..."
              className="pl-10"
            />
          </div>
        </Card>

        {/* Recipes Table */}
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Färdigvara</TableHead>
                <TableHead>Komponenter</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Åtgärder</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecipes.map((recipe) => (
                <TableRow key={recipe.id}>
                  <TableCell className="font-mono font-medium">{recipe.sku}</TableCell>
                  <TableCell>{recipe.name}</TableCell>
                  <TableCell>
                    {recipe.hasRecipe ? (
                      <span className="text-sm text-slate-600">
                        {recipe.components.length} st
                      </span>
                    ) : (
                      <span className="text-sm text-slate-400">Inget recept</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {recipe.hasRecipe ? (
                      <Badge className="bg-green-100 text-green-700 font-normal">
                        Komplett
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-500 font-normal">
                        Saknas
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => handleEdit(recipe)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      {recipe.hasRecipe && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDelete(recipe)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredRecipes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-slate-500">
                    <ChefHat className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Inga färdigvaror hittades</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  );
}