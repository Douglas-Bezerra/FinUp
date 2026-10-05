// webapp/tests/e2e/login.spec.ts
// Teste de login e redirecionamento de rotas
//===========================================

import { expect, test } from '@playwright/test'

test('exibe o login e permite mostrar ou ocultar a senha', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'Bem-vindo de volta' }),
  ).toBeVisible()
  await expect(page.getByLabel('E-mail')).toBeVisible()

  const password = page.getByRole('textbox', { name: 'Senha' })
  await expect(password).toHaveAttribute('type', 'password')

  await page.getByRole('button', { name: 'Mostrar senha' }).click()
  await expect(password).toHaveAttribute('type', 'text')

  await page.getByRole('button', { name: 'Ocultar senha' }).click()
  await expect(password).toHaveAttribute('type', 'password')
})

test('redireciona rota desconhecida para a tela de login', async ({ page }) => {
  await page.goto('/rota-inexistente')

  await expect(page).toHaveURL('/')
  await expect(
    page.getByRole('heading', { name: 'Bem-vindo de volta' }),
  ).toBeVisible()
})

test('protege a tela de registros contra acesso sem login', async ({ page }) => {
  await page.goto('/registros')

  await expect(page).toHaveURL('/')
  await expect(
    page.getByRole('heading', { name: 'Bem-vindo de volta' }),
  ).toBeVisible()
})
