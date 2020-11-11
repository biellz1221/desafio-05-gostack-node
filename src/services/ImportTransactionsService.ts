import csvParse from 'csv-parse';
import fs from 'fs';
import path from 'path';

import { getRepository, getCustomRepository, In } from 'typeorm';
import uploadConfig from '../config/upload';

import TransactionsRepository from '../repositories/TransactionsRepository';

// import Transaction from '../models/Transaction';
import AppError from '../errors/AppError';
import Category from '../models/Category';
import Transaction from '../models/Transaction';

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  private async loadCSV(filepath: string): Promise<Transaction[]> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);
    const csvStream = fs.createReadStream(filepath);

    const parseStream = csvParse({
      fromLine: 2,
      ltrim: true,
      rtrim: true,
    });

    const parseCsv = csvStream.pipe(parseStream);

    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

    parseCsv.on('data', line => {
      // eslint-disable-next-line array-callback-return
      categories.push(line[3].toString());
      transactions.push({
        title: line[0].toString(),
        type: line[1].toString(),
        value: parseInt(line[2], 10),
        category: line[3].toString(),
      });
    });

    await new Promise(resolve => {
      parseCsv.on('end', resolve);
    });

    const categoriesExist = await categoriesRepository.find({
      where: { title: In(categories) },
    });

    // console.log(categoriesExist);

    const existentCategoriesTitles = categoriesExist.map(
      (category: Category) => category.title,
    );

    const addCategoryTitles = categories
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoriesRepository.create(
      addCategoryTitles.map(title => ({ title })),
    );

    await categoriesRepository.save(newCategories);

    const finalCategories = [...newCategories, ...categoriesExist];

    const createdTransactions = transactionsRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: finalCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    await transactionsRepository.save(createdTransactions);

    await fs.promises.unlink(filepath);

    return createdTransactions;
  }

  async execute(fileName: string): Promise<Transaction[]> {
    const csvPath = path.resolve(uploadConfig.directory, fileName);
    const transactions = await this.loadCSV(csvPath);
    return transactions;
  }
}

export default ImportTransactionsService;
