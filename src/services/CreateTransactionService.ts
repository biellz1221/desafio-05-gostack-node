import { getCustomRepository, getRepository } from 'typeorm';
import AppError from '../errors/AppError';

import TransactionsRepository from '../repositories/TransactionsRepository';
import Transaction from '../models/Transaction';
import Category from '../models/Category';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transaction> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    const categoryRepository = getRepository(Category);

    let transactionCategory = await categoryRepository.findOne({
      where: { title: category },
    });

    if (!transactionCategory) {
      transactionCategory = categoryRepository.create({
        title: category,
      });
      await categoryRepository.save(transactionCategory);
    }

    const balance = await transactionsRepository.getBalance();

    if (type === 'outcome' && value > balance.total) {
      throw new AppError('não pode gastar mais do que tem');
    }

    const transaction = transactionsRepository.create({
      title,
      value,
      type,
      category: transactionCategory,
    });

    console.log('create transaction category', category);
    console.log('create transaction', transaction);

    await transactionsRepository.save(transaction);
    return transaction;
  }
}

export default CreateTransactionService;
