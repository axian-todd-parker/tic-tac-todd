import { expect, test } from '@playwright/test'

test('a player can win a full game against the deterministic CPU', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'Local Tic Tac Toe with a predictable CPU opponent.' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Play vs. CPU' }).click()

  await expect(page).toHaveURL(/\/local$/)
  await expect(page.getByText('Your turn')).toBeVisible()

  await page.getByTestId('cell-4').click()
  await expect(page.getByText('CPU is thinking...')).toBeVisible()
  await expect(page.getByTestId('cell-0')).toContainText('O')

  await page.getByTestId('cell-2').click()
  await expect(page.getByTestId('cell-1')).toContainText('O')

  await page.getByTestId('cell-6').click()

  await expect(page.getByText('You won. Clean finish.')).toBeVisible()
  await expect(page.getByText('Winning line: 3, 5, 7')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Rematch' })).toBeVisible()
})

test('two multiplayer players receive live websocket updates and finish a shared game', async ({
  browser,
}) => {
  const playerOne = await browser.newPage()
  const playerTwo = await browser.newPage()

  await playerOne.goto('/')
  await playerOne.getByTestId('create-multiplayer').click()

  await expect(playerOne).toHaveURL(/\/multiplayer\//)
  await expect(playerOne.getByText('Waiting for another player to join.')).toBeVisible()

  await playerTwo.goto('/')
  await playerTwo.getByRole('button', { name: 'Refresh Waiting' }).click()
  await playerTwo.getByRole('button', { name: 'Join' }).first().click()

  await expect(playerTwo).toHaveURL(/\/multiplayer\//)
  await expect(playerOne.getByText('Your turn')).toBeVisible()
  await expect(playerTwo.getByText("Opponent's turn")).toBeVisible()

  await playerOne.getByTestId('cell-0').click()
  await expect(playerTwo.getByTestId('cell-0')).toContainText('X')
  await expect(playerTwo.getByText('Your turn')).toBeVisible()

  await playerTwo.getByTestId('cell-4').click()
  await expect(playerOne.getByTestId('cell-4')).toContainText('O')
  await expect(playerOne.getByText('Your turn')).toBeVisible()

  await playerOne.getByTestId('cell-1').click()
  await expect(playerTwo.getByTestId('cell-1')).toContainText('X')

  await playerTwo.getByTestId('cell-5').click()
  await expect(playerOne.getByTestId('cell-5')).toContainText('O')

  await playerOne.getByTestId('cell-2').click()

  await expect(playerOne.getByText('You won the multiplayer match.')).toBeVisible()
  await expect(playerTwo.getByText('You lost. Try again.')).toBeVisible()

  await playerOne.close()
  await playerTwo.close()
})

test('a spectator can open an active game and watch live moves', async ({ browser }) => {
  const playerOne = await browser.newPage()
  const playerTwo = await browser.newPage()
  const spectator = await browser.newPage()

  await playerOne.goto('/')
  await playerOne.getByTestId('create-multiplayer').click()
  await expect(playerOne).toHaveURL(/\/multiplayer\//)

  await playerTwo.goto('/')
  await playerTwo.getByRole('button', { name: 'Refresh Waiting' }).click()
  await playerTwo.getByRole('button', { name: 'Join' }).first().click()
  await expect(playerTwo).toHaveURL(/\/multiplayer\//)

  await spectator.goto('/')
  await spectator.getByRole('button', { name: 'Refresh Active' }).click()
  await spectator.getByRole('button', { name: 'Spectate' }).first().click()

  await expect(spectator).toHaveURL(/\/multiplayer\//)
  await expect(spectator.getByText('Watching live. X to move.')).toBeVisible()
  await expect(spectator.getByText('You Are')).toBeVisible()
  await expect(spectator.getByText('spectator')).toBeVisible()

  await playerOne.getByTestId('cell-0').click()
  await expect(spectator.getByTestId('cell-0')).toContainText('X')
  await expect(spectator.getByText('Watching live. O to move.')).toBeVisible()

  await playerTwo.getByTestId('cell-4').click()
  await expect(spectator.getByTestId('cell-4')).toContainText('O')

  await playerOne.close()
  await playerTwo.close()
  await spectator.close()
})
