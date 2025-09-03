import { PrismaClient } from '@prisma/client';
import type { Categoria, Subcategoria } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';

const prisma = new PrismaClient();

// --- Type Definitions for the Tree Structure ---
interface SubcategoriaNode extends Subcategoria {
  children: SubcategoriaNode[];
}

interface CategoriaNode extends Categoria {
  subcategorias: SubcategoriaNode[];
}

/**
 * Builds a nested tree structure from a flat list of subcategories using an
 * efficient, non-recursive approach.
 * @param subcategories Flat list of all subcategories.
 * @returns An array of root-level subcategory nodes.
 */
function buildTree(subcategories: Subcategoria[]): SubcategoriaNode[] {
  const tree: SubcategoriaNode[] = [];
  const lookupMap: { [id: number]: SubcategoriaNode } = {};

  // 1. Initialize map and add a 'children' array to each item.
  subcategories.forEach(sub => {
    lookupMap[sub.id] = { ...sub, children: [] };
  });

  // 2. Iterate and assign children to their parents in the map.
  subcategories.forEach(sub => {
    if (sub.parent_subcategoriaId !== null) {
      const parent = lookupMap[sub.parent_subcategoriaId];
      if (parent) {
        parent.children.push(lookupMap[sub.id]);
      }
    } else {
      // If a subcategory has no parent, it's a root node.
      tree.push(lookupMap[sub.id]);
    }
  });

  return tree;
}

async function generateCategoriesData() {
  console.log('Fetching categories and subcategories from the database...');

  try {
    // 1. Fetch all necessary data from the database
    const allCategorias = await prisma.categoria.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });

    const allSubcategorias = await prisma.subcategoria.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
    });

    const relations = await prisma.subcategoriaCategorias.findMany({
      where: { activo: true },
    });

    console.log('Data fetched successfully. Building the hierarchical tree...');

    // 2. Create a lookup map for which categories a subcategory belongs to
    const subcategoriaToCategoriaMap = relations.reduce((acc, link) => {
      if (!acc[link.subcategoriaId]) {
        acc[link.subcategoriaId] = [];
      }
      acc[link.subcategoriaId].push(link.categoriaId);
      return acc;
    }, {} as Record<number, number[]>);

    // 3. Build the hierarchical tree for ALL subcategories first
    const entireSubcategoriaTree = buildTree(allSubcategorias);

    // 4. Assign the relevant subcategory trees to each main category
    const finalTree: CategoriaNode[] = allCategorias.map(cat => {
      // Get the IDs of top-level subcategories linked to this category
      const topLevelSubIdsForCategoria = new Set(
        relations
          .filter(r => r.categoriaId === cat.id)
          .map(r => r.subcategoriaId)
      );

      // Filter the entire subcategory tree to get only the branches
      // that start with a subcategory linked to the current category.
      const subcategoriasForCategoria = entireSubcategoriaTree.filter(sub => 
        topLevelSubIdsForCategoria.has(sub.id)
      );

      return {
        ...cat,
        subcategorias: subcategoriasForCategoria,
      };
    });

    // 5. Write the hierarchical data to a JSON file
    const dataDir = path.resolve(process.cwd(), 'src/data');
    const filePath = path.resolve(dataDir, 'categories.json');

    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(finalTree, null, 2));
    console.log(`✅ Successfully generated hierarchical categories data at ${filePath}`);

  } catch (error) {
    console.error('Error during data generation:', error);
    throw error;
  }
}

generateCategoriesData()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });